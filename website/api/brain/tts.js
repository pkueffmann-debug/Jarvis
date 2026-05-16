// /api/brain/tts — ElevenLabs primary, OpenAI fallback.
// Auth-gated. Caches ElevenLabs failures for 5 minutes so a broken quota
// doesn't add 500ms to every voice answer.

const { gate } = require('../_lib/auth');

// Skip ElevenLabs until this timestamp (set when we see 401/402/403).
let _elBlockedUntil = 0;
const EL_BLOCK_MS = 5 * 60 * 1000;

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.statusCode = 405; return res.end('method not allowed'); }
  const user = await gate(req, res);
  if (!user) return;

  const body = req.body && Object.keys(req.body).length ? req.body : await readJSON(req);
  const text = body.text;
  if (!text) { res.statusCode = 400; return res.end(JSON.stringify({ error: 'text required' })); }
  const payload = text.length > 4000 ? text.slice(0, 4000) + '…' : text;

  const elKey   = process.env.ELEVENLABS_API_KEY;
  const elVoice = process.env.ELEVENLABS_VOICE_ID;
  const elDisabled = process.env.ELEVENLABS_DISABLED === '1';
  if (elKey && elVoice && !elDisabled && Date.now() > _elBlockedUntil) {
    try {
      // Short timeout so a slow ElevenLabs response doesn't drag us down.
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 1500);
      const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elVoice}`, {
        method: 'POST',
        headers: { 'xi-api-key': elKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({
          text: payload, model_id: 'eleven_turbo_v2_5',
          voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.08, use_speaker_boost: true },
        }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (r.ok) {
        const buf = Buffer.from(await r.arrayBuffer());
        res.setHeader('Content-Type', 'audio/mpeg');
        return res.end(buf);
      }
      if ([401, 402, 403, 429].includes(r.status)) {
        _elBlockedUntil = Date.now() + EL_BLOCK_MS;
        console.warn(`[tts] ElevenLabs ${r.status} — disabling for ${EL_BLOCK_MS/1000}s`);
      } else {
        console.warn(`[tts] ElevenLabs ${r.status} — single fallback`);
      }
    } catch (e) {
      console.warn('[tts] ElevenLabs error:', e.message);
    }
  }
  const oaKey = process.env.OPENAI_API_KEY;
  if (!oaKey) { res.statusCode = 500; return res.end(JSON.stringify({ error: 'no TTS provider' })); }
  try {
    const r = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${oaKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'tts-1', voice: 'onyx', input: payload, response_format: 'mp3' }),
    });
    if (!r.ok) { res.statusCode = 500; return res.end(JSON.stringify({ error: `OpenAI TTS ${r.status}` })); }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.end(buf);
  } catch (e) {
    console.error('[tts]', e);
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
