const { Porcupine, BuiltinKeyword } = require('@picovoice/porcupine-node');

let _porcupine   = null;
let _onDetected  = null;
let _active      = false;

function init(accessKey, onDetected) {
  try {
    if (_porcupine) { _porcupine.release(); _porcupine = null; }

    _porcupine  = new Porcupine(accessKey, [BuiltinKeyword.JARVIS], [0.5]);
    _onDetected = onDetected;
    _active     = true;

    console.log('[WakeWord] Porcupine ready — listening for "JARVIS"');
    return { ok: true, frameLength: _porcupine.frameLength, sampleRate: _porcupine.sampleRate };
  } catch (e) {
    console.error('[WakeWord] Init failed:', e.message);
    return { ok: false, error: e.message };
  }
}

// Called from main process IPC with an Int16Array-compatible array
function processFrame(samples) {
  if (!_porcupine || !_active) return;
  try {
    const int16 = samples instanceof Int16Array ? samples : Int16Array.from(samples);
    const index = _porcupine.process(int16);
    if (index >= 0) {
      console.log('[WakeWord] "JARVIS" detected!');
      _onDetected?.();
    }
  } catch { /* ignore single-frame errors */ }
}

function stop() {
  _active = false;
  if (_porcupine) { _porcupine.release(); _porcupine = null; }
  console.log('[WakeWord] Stopped.');
}

const isActive     = () => _active && !!_porcupine;
const frameLength  = () => _porcupine?.frameLength  ?? 512;
const sampleRate   = () => _porcupine?.sampleRate   ?? 16000;

module.exports = { init, processFrame, stop, isActive, frameLength, sampleRate };
