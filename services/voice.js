const OpenAI  = require('openai');
const fs      = require('fs');
const path    = require('path');
const os      = require('os');
const { execFile, execSync } = require('child_process');

let _openai = null;
function getOpenAI() {
  if (!_openai) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY fehlt.');
    _openai = new OpenAI({ apiKey: key });
  }
  return _openai;
}

// ── whisper.cpp local detection ───────────────────────────────────────────────
const WHISPER_BINS = [
  '/opt/homebrew/bin/whisper-cpp',
  '/usr/local/bin/whisper-cpp',
  '/opt/homebrew/bin/whisper',
  '/usr/local/bin/whisper',
];
const WHISPER_MODELS = [
  path.join(os.homedir(), '.cache', 'whisper', 'ggml-base.bin'),
  path.join(os.homedir(), '.cache', 'whisper', 'ggml-small.bin'),
  '/opt/homebrew/share/whisper/ggml-base.bin',
  '/usr/local/share/whisper/ggml-base.bin',
];

function findWhisper() {
  const bin   = WHISPER_BINS.find(p => { try { return fs.existsSync(p); } catch { return false; } });
  const model = WHISPER_MODELS.find(p => { try { return fs.existsSync(p); } catch { return false; } });
  return bin && model ? { bin, model } : null;
}

function transcribeLocal(wavPath, whisper) {
  return new Promise((resolve, reject) => {
    execFile(
      whisper.bin,
      ['-m', whisper.model, '-f', wavPath, '--output-txt', '-', '--no-timestamps', '-l', 'auto'],
      { timeout: 20000 },
      (err, stdout) => {
        if (err) return reject(err);
        // whisper-cpp outputs "[00:00.000 --> 00:05.000]  text" — strip timestamps
        const text = stdout.split('\n')
          .map(l => l.replace(/^\[.*?\]\s*/, '').trim())
          .filter(Boolean)
          .join(' ')
          .trim();
        resolve(text);
      }
    );
  });
}

async function transcribeAudio(audioBuffer, mimeType = 'audio/webm') {
  const ext = mimeType.includes('mp4') || mimeType.includes('m4a') ? 'm4a'
    : mimeType.includes('ogg') ? 'ogg'
    : 'webm';

  const tmpPath = path.join(os.tmpdir(), `jarvis-stt-${Date.now()}.${ext}`);
  fs.writeFileSync(tmpPath, audioBuffer);

  try {
    // Try local whisper.cpp first (near-zero latency)
    const whisper = findWhisper();
    if (whisper) {
      try {
        // whisper.cpp needs WAV — convert via ffmpeg if available
        let inputPath = tmpPath;
        const wavPath = tmpPath.replace(/\.\w+$/, '.wav');
        try {
          execSync(`ffmpeg -y -i "${tmpPath}" -ar 16000 -ac 1 "${wavPath}" -loglevel quiet`, { timeout: 10000 });
          inputPath = wavPath;
        } catch {
          // ffmpeg not available — try passing original (may work for wav)
        }
        const text = await transcribeLocal(inputPath, whisper);
        if (wavPath !== tmpPath) fs.unlink(wavPath, () => {});
        return text;
      } catch (localErr) {
        console.warn('[Voice] whisper.cpp failed, falling back to API:', localErr.message);
      }
    }

    // Fallback: OpenAI Whisper API
    const client = getOpenAI();
    const result = await client.audio.transcriptions.create({
      file: fs.createReadStream(tmpPath),
      model: 'whisper-1',
    });
    return result.text;
  } finally {
    fs.unlink(tmpPath, () => {});
  }
}

async function textToSpeech(text) {
  const payload = text.length > 4000 ? text.slice(0, 4000) + '…' : text;

  // Try ElevenLabs first (primary voice). Fall through to OpenAI on any
  // failure — including 401/403, which is what kills the loop when the
  // user's ElevenLabs key has expired or is missing.
  const elKey  = process.env.ELEVENLABS_API_KEY;
  const elVoice = process.env.ELEVENLABS_VOICE_ID;
  if (elKey && elVoice) {
    try {
      const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elVoice}`, {
        method: 'POST',
        headers: { 'xi-api-key': elKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
        body: JSON.stringify({
          text: payload,
          model_id: 'eleven_turbo_v2_5',
          voice_settings: { stability: 0.55, similarity_boost: 0.75, style: 0.08, use_speaker_boost: true },
        }),
      });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      console.warn(`[TTS] ElevenLabs ${res.status} — falling back to OpenAI`);
    } catch (e) {
      console.warn('[TTS] ElevenLabs network error — falling back to OpenAI:', e.message);
    }
  }

  // OpenAI TTS fallback (uses the same key as Whisper STT).
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[TTS] No OPENAI_API_KEY for fallback — silent.');
    return null;
  }
  try {
    const client = getOpenAI();
    const out = await client.audio.speech.create({
      model: 'tts-1',
      voice: 'onyx',   // deep masculine voice, JARVIS-appropriate
      input: payload,
      response_format: 'mp3',
    });
    const arrBuf = await out.arrayBuffer();
    return Buffer.from(arrBuf);
  } catch (e) {
    console.error('[TTS] OpenAI fallback also failed:', e.message);
    return null;
  }
}

module.exports = { transcribeAudio, textToSpeech };
