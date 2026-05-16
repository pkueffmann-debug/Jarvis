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
    const fd = new FormData();
    const blob = new Blob([audio.buffer], { type: audio.mime || 'audio/webm' });
    fd.append('file', blob, audio.filename || 'audio.webm');
    fd.append('model', 'whisper-1');

    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${oaKey}` },
      body: fd,
    });
    if (!r.ok) {
      const t = await r.text();
      res.statusCode = 500;
      return res.end(JSON.stringify({ error: `Whisper ${r.status}: ${t.slice(0, 200)}` }));
    }
    const j = await r.json();
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ text: j.text || '' }));
  } catch (e) {
    console.error('[transcribe]', e);
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
