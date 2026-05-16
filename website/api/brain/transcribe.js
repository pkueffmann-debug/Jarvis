// /api/brain/transcribe — Whisper STT. Multipart audio upload.
// On Vercel we use the raw request stream because multer wouldn't survive
// the serverless cold-start nicely. The OpenAI SDK isn't used either —
// we just relay multipart to OpenAI directly.

const { gate } = require('../_lib/auth');
const Busboy = (() => { try { return require('busboy'); } catch { return null; } })();

module.exports.config = { api: { bodyParser: false } };

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.statusCode = 405; return res.end('method not allowed'); }
  const user = await gate(req, res);
  if (!user) return;

  const oaKey = process.env.OPENAI_API_KEY;
  if (!oaKey) { res.statusCode = 500; return res.end(JSON.stringify({ error: 'OPENAI_API_KEY missing' })); }
  if (!Busboy) { res.statusCode = 500; return res.end(JSON.stringify({ error: 'busboy not installed' })); }

  try {
    const audio = await readAudioPart(req);
    if (!audio || !audio.buffer.length) {
      res.statusCode = 400;
      return res.end(JSON.stringify({ error: 'no audio uploaded' }));
    }

    // 20 s ceiling + 1 retry on transient OpenAI failures.
    // Whisper usually returns in 1-3 s; anything past 20 s is hung.
    const WHISPER_TIMEOUT_MS = 20_000;
    const RETRIES = 1;

    async function callWhisper() {
      const fd = new FormData();
      const blob = new Blob([audio.buffer], { type: audio.mime || 'audio/webm' });
      fd.append('file', blob, audio.filename || 'audio.webm');
      fd.append('model', 'whisper-1');

      const ctrl = new AbortController();
      const tid  = setTimeout(() => ctrl.abort(), WHISPER_TIMEOUT_MS);
      try {
        return await fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${oaKey}` },
          body: fd,
          signal: ctrl.signal,
        });
      } finally {
        clearTimeout(tid);
      }
    }

    let r, lastErr;
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
      try {
        r = await callWhisper();
        // Retry 5xx (transient OpenAI issues), pass through 4xx (our bug).
        if (r.status >= 500 && r.status < 600 && attempt < RETRIES) {
          console.warn(`[transcribe] OpenAI ${r.status}, retrying (${attempt + 1}/${RETRIES})`);
          await new Promise(rs => setTimeout(rs, 1000));
          continue;
        }
        break;
      } catch (e) {
        lastErr = e;
        const isAbort = e.name === 'AbortError';
        console.warn(`[transcribe] attempt ${attempt + 1} ${isAbort ? 'TIMEOUT' : 'NETWORK'}: ${e.message}`);
        if (attempt < RETRIES) {
          await new Promise(rs => setTimeout(rs, 1000));
          continue;
        }
        throw lastErr;
      }
    }

    if (!r.ok) {
      const t = await r.text();
      console.error('[transcribe] OpenAI rejected:', r.status, t.slice(0, 200));
      res.statusCode = 500;
      return res.end(JSON.stringify({ error: `Whisper ${r.status}: ${t.slice(0, 200)}` }));
    }
    const j = await r.json();
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ text: j.text || '' }));
  } catch (e) {
    console.error('[transcribe] failed', {
      message: e?.message,
      name: e?.name,
      stack: e?.stack?.split('\n').slice(0, 4).join('\n'),
    });
    res.statusCode = 500;
    res.end(JSON.stringify({ error: e.message }));
  }
};

function readAudioPart(req) {
  return new Promise((resolve, reject) => {
    const bb = Busboy({ headers: req.headers });
    let out = null;
    bb.on('file', (_name, file, info) => {
      const chunks = [];
      file.on('data', (c) => chunks.push(c));
      file.on('end', () => {
        out = { buffer: Buffer.concat(chunks), mime: info.mimeType, filename: info.filename };
      });
    });
    bb.on('finish', () => resolve(out));
    bb.on('error', reject);
    req.pipe(bb);
  });
}
