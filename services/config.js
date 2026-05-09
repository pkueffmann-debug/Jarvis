const { app } = require('electron');
const path = require('path');
const fs   = require('fs');

// Computed lazily after app is ready (app.getPath requires app to be ready)
function configFile() {
  return path.join(app.getPath('userData'), 'jarvis-config.json');
}

function load() {
  try {
    const f = configFile();
    if (fs.existsSync(f)) {
      return JSON.parse(fs.readFileSync(f, 'utf8'));
    }
  } catch {}
  return {};
}

function save(data) {
  try {
    fs.writeFileSync(configFile(), JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (e) {
    console.error('[config] save failed:', e.message);
    return false;
  }
}

function get(key) {
  const stored = load()[key];
  // Fall back to env var (dev mode)
  if (stored) return stored;
  const envMap = {
    ANTHROPIC_API_KEY:    process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY:       process.env.OPENAI_API_KEY,
    ELEVENLABS_API_KEY:   process.env.ELEVENLABS_API_KEY,
    ELEVENLABS_VOICE_ID:  process.env.ELEVENLABS_VOICE_ID,
    PICOVOICE_ACCESS_KEY: process.env.PICOVOICE_ACCESS_KEY,
  };
  return envMap[key] || '';
}

function set(key, value) {
  const data = load();
  if (value) data[key] = value;
  else delete data[key];
  save(data);
  // Also apply immediately to current process
  if (value) process.env[key] = value;
  else delete process.env[key];
}

function applyToEnv() {
  const data = load();
  for (const [k, v] of Object.entries(data)) {
    if (v && !process.env[k]) process.env[k] = v;
  }
}

module.exports = { get, set, applyToEnv, load };
