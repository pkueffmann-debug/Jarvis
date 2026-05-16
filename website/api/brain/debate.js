// /api/brain/debate — Multi-agent ultra mode.
//
// Stage 1: three workers (Claude / GPT / Gemini) answer in PARALLEL.
// Stage 2: a critic (Claude) reviews all three and writes a synthesis prompt.
// Stage 3: synthesizer (Claude) writes the final user-facing answer.
//
// Total latency ≈ max(worker latency) + critic + synthesizer.
// Falls back gracefully if a provider is missing — only available workers run.
//
// Body: { messages }   (last N turns; final one must be the user's question)
// Returns:
//   { reply, debate: [{provider, model, text}], synthesis }

const { gate } = require('../_lib/auth');
const { askProvider, availableProviders } = require('../_lib/providers');
const { loadFactsFor } = require('./memory');

// Workers we'd LIKE to run (in preference order). Only the available
// providers actually fire — others get skipped silently.
const WORKER_CANDIDATES = [
  { provider: 'anthropic', tier: 'default' },
  { provider: 'openai',    tier: 'smart'   },
  { provider: 'gemini',    tier: 'smart'   },
  { provider: 'groq',      tier: 'default' },
];

function buildWorkerSystem({ facts }) {
  const memBlock = facts?.length
    ? '\n\nKnown facts about the user:\n' + facts.slice(0, 20).map(f => `- ${f.fact}`).join('\n')
    : '';
  return `You are one of three AI experts answering a user's question. Another expert is doing the same in parallel. Be DIRECT, take a real stance, and disagree with conventional wisdom if you believe it's wrong. 2–4 short paragraphs max. No filler. Address the user as "Sir" if writing in German.${memBlock}`;
}

function buildSynthSystem() {
  return `Du bist JARVIS — Pauls Assistent. Drei AI-Experten haben gerade dieselbe Frage beantwortet. Du bekommst alle drei Antworten plus eine Critic-Notiz. Schreibe DIE Antwort an den Nutzer:
- Auf Deutsch (es sei denn die Frage war Englisch).
- 2–4 prägnante Sätze. Keine Aufzählungen, keine Markdown.
- Wenn die Experten sich einig sind: liefer die beste gemeinsame Antwort.
- Wenn sie sich widersprechen: nenn den Konflikt knapp und gib eine begründete Empfehlung.
- Sprich den Nutzer mit „Sir" an. Iron-Man-Stil: kompetent, knapp, trocken.
- Erwähne NIE „die KIs sagen" — sprich in eigener Stimme als JARVIS.`;
}

function buildCriticSystem() {
  return `You are an impartial critic of LLM answers. Given 2–4 expert answers to a question, identify in 3–5 short bullet points:
- Where they agree
- Where they disagree (and which seems more correct)
- Any factual error
- The single most important point to convey to the user

Keep it terse — this is internal reasoning, not a final answer.`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.statusCode = 405; return res.end('method not allowed'); }

  const user = await gate(req, res);
  if (!user) return;

  const body = req.body && Object.keys(req.body).length ? req.body : await readJSON(req);
  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (!messages.length) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'messages required' })); }

  const userQuestion = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user' && typeof messages[i].content === 'string') return messages[i].content;
    }
    return '';
  })();
  if (!userQuestion) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'no user message' })); }

  const available = new Set(availableProviders());
  const workers = WORKER_CANDIDATES.filter(w => available.has(w.provider)).slice(0, 3);
  if (workers.length === 0) {
    res.statusCode = 500;
    return res.end(JSON.stringify({ error: 'no providers configured' }));
  }

  try {
    const facts = await loadFactsFor(user.id);
    const workerSystem = buildWorkerSystem({ facts });

    // ── Stage 1: parallel worker answers ───────────────────────────────
    const t0 = Date.now();
    const settled = await Promise.allSettled(workers.map(w =>
      askProvider({
        provider: w.provider,
        tier: w.tier,
        system: workerSystem,
        messages,             // full history so each worker sees context
        max_tokens: 500,
        temperature: 0.7,
      })
    ));

    const debate = [];
    for (let i = 0; i < settled.length; i++) {
      if (settled[i].status === 'fulfilled') {
        const r = settled[i].value;
        debate.push({ provider: r.provider, model: r.raw?.model || workers[i].provider, text: r.text });
      } else {
        console.warn('[debate] worker failed', workers[i].provider, settled[i].reason?.message);
      }
    }
    if (!debate.length) {
      res.statusCode = 500;
      return res.end(JSON.stringify({ error: 'all workers failed' }));
    }
    const workerMs = Date.now() - t0;

    // ── Stage 2: critic ────────────────────────────────────────────────
    const criticInput = debate.map((d, i) => `=== Expert ${i + 1} (${d.provider}) ===\n${d.text}`).join('\n\n');
    let criticNote = '';
    try {
      const c = await askProvider({
        provider: available.has('anthropic') ? 'anthropic' : workers[0].provider,
        tier: 'fast',
        system: buildCriticSystem(),
        messages: [{ role: 'user', content: `Question:\n${userQuestion}\n\nAnswers to compare:\n\n${criticInput}` }],
        max_tokens: 350,
        temperature: 0.3,
      });
      criticNote = c.text;
    } catch (e) {
      console.warn('[debate] critic failed', e.message);
    }

    // ── Stage 3: synthesizer ───────────────────────────────────────────
    const synthMsg = `Frage des Nutzers:\n${userQuestion}\n\nDrei Experten-Antworten:\n\n${criticInput}\n\nCritic-Notiz:\n${criticNote || '(keine)'}\n\nSchreib die finale Antwort an den Nutzer.`;
    const synth = await askProvider({
      provider: available.has('anthropic') ? 'anthropic' : workers[0].provider,
      tier: 'default',
      system: buildSynthSystem(),
      messages: [{ role: 'user', content: synthMsg }],
      max_tokens: 350,
      temperature: 0.4,
    });

    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      reply: (synth.text || '').trim() || 'Verstanden, Sir.',
      debate,
      synthesis: { provider: synth.provider, text: synth.text },
      critic: criticNote,
      timings: { workerMs, totalMs: Date.now() - t0 },
    }));
  } catch (e) {
    console.error('[brain/debate]', e);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: e.message }));
  }
};

function readJSON(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { resolve({}); } });
    req.on('error', () => resolve({}));
  });
}
