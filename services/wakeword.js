/**
 * Wake Word Service — dual backend
 *
 * Priority 1: OpenWakeWord subprocess (bundled binary, no account needed)
 * Priority 2: Picovoice Porcupine (original, needs API key)
 *
 * Build the OWW binary: npm run build:wakeword
 * The binary is placed in resources/wakeword (dev) or bundled via extraResources (production).
 */

const path    = require('path');
const fs      = require('fs');
const { app } = require('electron');
const { spawn } = require('child_process');

// ── OWW binary path ────────────────────────────────────────────────────────

function owwBinaryPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'wakeword');
  }
  const devPath = path.join(__dirname, '..', 'resources', 'wakeword');
  return fs.existsSync(devPath) ? devPath : null;
}

// ── State ──────────────────────────────────────────────────────────────────

let _owwProcess    = null;
let _porcupine     = null;
let _onDetected    = null;
let _active        = false;
let _backend       = null; // 'oww' | 'porcupine'

// ── OWW subprocess ─────────────────────────────────────────────────────────

function initOWW(onDetected) {
  const bin = owwBinaryPath();
  if (!bin) return { ok: false, error: 'OWW binary not found — run: npm run build:wakeword' };

  try { fs.chmodSync(bin, 0o755); } catch {}

  _owwProcess = spawn(bin, [], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ORT_LOGGING_LEVEL: '3', TF_CPP_MIN_LOG_LEVEL: '3' },
  });

  let ready = false;

  _owwProcess.stdout.on('data', (data) => {
    data.toString().trim().split('\n').forEach(line => {
      if (line.startsWith('READY:')) {
        console.log(`[WakeWord] OWW ready — model: ${line.slice(6)}`);
        ready = true;
        _active = true;
      } else if (line === 'WAKE_WORD_DETECTED' && ready) {
        console.log('[WakeWord] Hey JARVIS detected!');
        onDetected?.();
      } else if (line.startsWith('ERROR:')) {
        console.error('[WakeWord] OWW error:', line.slice(6));
      }
    });
  });

  _owwProcess.stderr.on('data', (d) => {
    const s = d.toString();
    if (s.includes('Error') || s.includes('Traceback')) console.error('[WakeWord]', s.trim());
  });

  _owwProcess.on('exit', (code) => {
    console.log(`[WakeWord] OWW process exited (code ${code})`);
    _active = false; _owwProcess = null;
  });

  _owwProcess.on('error', (e) => {
    console.error('[WakeWord] Failed to start OWW binary:', e.message);
    _active = false; _owwProcess = null;
  });

  _backend    = 'oww';
  _onDetected = onDetected;
  return { ok: true, backend: 'oww' };
}

// ── Porcupine fallback ─────────────────────────────────────────────────────

function initPorcupine(accessKey, onDetected) {
  try {
    const { Porcupine, BuiltinKeyword } = require('@picovoice/porcupine-node');
    _porcupine  = new Porcupine(accessKey, [BuiltinKeyword.JARVIS], [0.5]);
    _onDetected = onDetected;
    _active     = true;
    _backend    = 'porcupine';
    console.log('[WakeWord] Porcupine ready — listening for "JARVIS"');
    return { ok: true, backend: 'porcupine', frameLength: _porcupine.frameLength, sampleRate: _porcupine.sampleRate };
  } catch (e) {
    console.error('[WakeWord] Porcupine init failed:', e.message);
    return { ok: false, error: e.message };
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

function init(accessKey, onDetected) {
  if (_active) stop();

  // Try OWW first (no account needed, works for every buyer)
  const owwResult = initOWW(onDetected);
  if (owwResult.ok) return owwResult;

  // Fallback: Porcupine if API key available
  if (accessKey) return initPorcupine(accessKey, onDetected);

  console.warn('[WakeWord] No backend available. Build the OWW binary (npm run build:wakeword) or add PICOVOICE_ACCESS_KEY.');
  return { ok: false, error: owwResult.error };
}

function stop() {
  if (_owwProcess) { _owwProcess.kill('SIGTERM'); _owwProcess = null; }
  if (_porcupine)  { try { _porcupine.release(); } catch {} _porcupine = null; }
  _active = false; _backend = null;
  console.log('[WakeWord] Stopped.');
}

function processFrame(samples) {
  if (_backend !== 'porcupine' || !_porcupine || !_active) return;
  try {
    const int16  = samples instanceof Int16Array ? samples : Int16Array.from(samples);
    const result = _porcupine.process(int16);
    if (result >= 0) _onDetected?.();
  } catch {}
}

const isActive    = () => _active;
const frameLength = () => _porcupine?.frameLength ?? 512;
const sampleRate  = () => _porcupine?.sampleRate  ?? 16000;

module.exports = { init, processFrame, stop, isActive, frameLength, sampleRate };
