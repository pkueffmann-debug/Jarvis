const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const os = require('os');

let _openai = null;

function getOpenAI() {
  if (!_openai) {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY fehlt — bitte .env ausfüllen.');
    _openai = new OpenAI({ apiKey: key });
  }
  return _openai;
}

/**
 * Transcribes audio buffer via OpenAI Whisper.
 * @param {Buffer} audioBuffer
 * @param {string} mimeType  e.g. 'audio/webm'
 * @returns {Promise<string>} transcribed text
 */
async function transcribeAudio(audioBuffer, mimeType = 'audio/webm') {
  const client = getOpenAI();

  const ext = mimeType.includes('mp4') || mimeType.includes('m4a') ? 'm4a'
    : mimeType.includes('ogg') ? 'ogg'
    : 'webm';

  const tmpPath = path.join(os.tmpdir(), `jarvis-stt-${Date.now()}.${ext}`);
  fs.writeFileSync(tmpPath, audioBuffer);

  try {
    const result = await client.audio.transcriptions.create({
      file: fs.createReadStream(tmpPath),
      model: 'whisper-1',
      // no language → Whisper auto-detects DE/EN
    });
    return result.text;
  } finally {
    fs.unlink(tmpPath, () => {});
  }
}

/**
 * Converts text to speech via ElevenLabs.
 * Returns a Buffer with MP3 audio, or null if TTS is not configured.
 */
async function textToSpeech(text) {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;

  if (!apiKey || !voiceId) return null;

  // Truncate very long responses to avoid API limits
  const payload = text.length > 4000 ? text.slice(0, 4000) + '…' : text;

  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text: payload,
      model_id: 'eleven_turbo_v2_5', // fast + multilingual (DE/EN)
      voice_settings: {
        stability: 0.55,
        similarity_boost: 0.75,
        style: 0.08,          // minimal style → calm, professional
        use_speaker_boost: true,
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`ElevenLabs ${res.status}: ${res.statusText}`);
  }

  const buf = await res.arrayBuffer();
  return Buffer.from(buf);
}

module.exports = { transcribeAudio, textToSpeech };
