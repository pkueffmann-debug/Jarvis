import { useEffect, useRef, useCallback } from 'react';

const TARGET_SR = 16000;

// Downsample float32 audio from srcSR → TARGET_SR (simple linear interpolation)
function downsample(buffer, srcSR) {
  if (srcSR === TARGET_SR) return buffer;
  const ratio  = srcSR / TARGET_SR;
  const outLen = Math.floor(buffer.length / ratio);
  const out    = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const idx = i * ratio;
    const lo  = Math.floor(idx);
    const hi  = Math.min(lo + 1, buffer.length - 1);
    const frac = idx - lo;
    out[i] = buffer[lo] * (1 - frac) + buffer[hi] * frac;
  }
  return out;
}

function toInt16(float32) {
  const out = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return out;
}

// WakeWord — invisible component. Streams PCM frames to main process when enabled.
export default function WakeWord({ enabled, onDetected }) {
  const ctxRef    = useRef(null);
  const procRef   = useRef(null);
  const streamRef = useRef(null);
  const bufRef    = useRef(new Float32Array(0));
  const frameLen  = useRef(512);
  const activeRef = useRef(false);

  const stop = useCallback(() => {
    activeRef.current = false;
    try { procRef.current?.disconnect(); } catch {}
    try { ctxRef.current?.close(); }      catch {}
    streamRef.current?.getTracks().forEach(t => t.stop());
    procRef.current = ctxRef.current = streamRef.current = null;
    bufRef.current  = new Float32Array(0);
    window.jarvis?.wakeWordStop().catch(() => {});
  }, []);

  // Listen for detection from main process
  useEffect(() => {
    if (!window.jarvis?.onWakeWordDetected) return;
    window.jarvis.onWakeWordDetected(() => {
      onDetected?.();
    });
    return () => window.jarvis?.offWakeWordDetected?.();
  }, [onDetected]);

  useEffect(() => {
    if (!enabled || !window.jarvis?.wakeWordStart) return;

    let cancelled = false;

    async function start() {
      try {
        // Ask main process to init Porcupine and get frame params
        const info = await window.jarvis.wakeWordStart();
        if (!info.ok) {
          console.warn('[WakeWord]', info.error);
          return;
        }
        if (info.frameLength) frameLen.current = info.frameLength;

        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

        streamRef.current = stream;

        const ctx = new AudioContext();
        ctxRef.current = ctx;
        const actualSR = ctx.sampleRate;

        const src  = ctx.createMediaStreamSource(stream);
        // ScriptProcessorNode: 4096-sample chunks are fine — we accumulate & emit Porcupine frames
        const proc = ctx.createScriptProcessor(4096, 1, 1);
        procRef.current = proc;
        activeRef.current = true;

        proc.onaudioprocess = (e) => {
          if (!activeRef.current) return;
          const raw      = e.inputBuffer.getChannelData(0);
          const resampled = downsample(raw, actualSR);

          // Append to rolling buffer
          const merged = new Float32Array(bufRef.current.length + resampled.length);
          merged.set(bufRef.current);
          merged.set(resampled, bufRef.current.length);
          bufRef.current = merged;

          // Emit complete Porcupine frames (512 samples each)
          const flen = frameLen.current;
          while (bufRef.current.length >= flen) {
            const frame   = bufRef.current.slice(0, flen);
            bufRef.current = bufRef.current.slice(flen);
            const int16   = Array.from(toInt16(frame)); // plain Array for IPC
            window.jarvis.sendWakeWordFrame(int16);
          }
        };

        src.connect(proc);
        proc.connect(ctx.destination);

        console.log('[WakeWord] Streaming to Porcupine @ 16 kHz (src:', actualSR, 'Hz)');
      } catch (err) {
        console.error('[WakeWord] start failed:', err);
      }
    }

    start();
    return () => { cancelled = true; stop(); };
  }, [enabled, stop]);

  return null; // purely logical component
}
