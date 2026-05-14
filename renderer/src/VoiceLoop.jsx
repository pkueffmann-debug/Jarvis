import { useEffect, useRef, useCallback } from 'react';

/**
 * VoiceLoop — auto-listening voice loop for the HUD window.
 *
 * State cycle:
 *   listening  → (silence after speech) → processing
 *   processing → (Claude done)          → speaking
 *   speaking   → (TTS audio ended)      → listening (loop)
 *
 * Voice commands are matched on transcribed text BEFORE Claude is invoked:
 *   "open chat" / "öffne den chat" / "chat öffnen"   → onOpenChat()
 *   "close chat" / "schließ den chat" / "chat zu"    → onCloseChat()
 *
 * Renders nothing — purely behavioral.
 */
export default function VoiceLoop({ enabled, onState, onOpenChat, onCloseChat }) {
  const streamRef    = useRef(null);
  const ctxRef       = useRef(null);
  const analyserRef  = useRef(null);
  const recorderRef  = useRef(null);
  const chunksRef    = useRef([]);
  const mimeRef      = useRef('audio/webm');
  const rafRef       = useRef(0);
  const cancelledRef = useRef(false);
  const audioElRef   = useRef(null);

  const setState = useCallback((s) => { onState?.(s); }, [onState]);

  // ── matchers ────────────────────────────────────────────────────────────
  const matchOpenChat = (text) => {
    const t = text.toLowerCase().trim();
    return /\b(open|show|expand)\s+(the\s+)?chat\b/.test(t)
        || /\b(öffne|zeig|öffnen)\s+(den\s+|das\s+)?chat\b/.test(t)
        || /\bchat\s+öffnen\b/.test(t)
        || /\bchat\s+auf\b/.test(t);
  };
  const matchCloseChat = (text) => {
    const t = text.toLowerCase().trim();
    return /\b(close|hide|collapse|exit)\s+(the\s+)?chat\b/.test(t)
        || /\b(schließ|schließe|verstecke)\s+(den\s+|das\s+)?chat\b/.test(t)
        || /\bchat\s+(schließen|zu)\b/.test(t);
  };

  // ── cleanup ─────────────────────────────────────────────────────────────
  const stopAll = useCallback(() => {
    cancelledRef.current = true;
    cancelAnimationFrame(rafRef.current);
    try { recorderRef.current?.stop(); } catch {}
    try { audioElRef.current?.pause(); } catch {}
    try { ctxRef.current?.close(); } catch {}
    streamRef.current?.getTracks().forEach((t) => t.stop());
    recorderRef.current = null;
    audioElRef.current  = null;
    analyserRef.current = null;
    ctxRef.current      = null;
    streamRef.current   = null;
    chunksRef.current   = [];
  }, []);

  // ── one listen pass (records until silence, then transcribes) ──────────
  const listenOnce = useCallback(async () => {
    if (cancelledRef.current) return null;
    setState('listening');

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
    } catch (err) {
      console.warn('[VoiceLoop] mic permission denied:', err?.message);
      setState('idle');
      return null;
    }
    if (cancelledRef.current) { stream.getTracks().forEach((t) => t.stop()); return null; }
    streamRef.current = stream;

    // VAD setup
    const ctx = new AudioContext();
    ctxRef.current = ctx;
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    src.connect(analyser);
    analyserRef.current = analyser;
    const buf = new Uint8Array(analyser.frequencyBinCount);

    // Recorder
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'].find(
      (m) => MediaRecorder.isTypeSupported(m)
    ) || 'audio/webm';
    mimeRef.current = mime;
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    recorderRef.current = recorder;
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.start(80);

    // VAD loop
    const SPEECH_THRESHOLD   = 0.045;  // 0..1 RMS, tuned for typical mic gain
    const SILENCE_HANG_MS    = 1500;   // stop this long after last speech
    const MAX_LISTEN_MS      = 8000;   // give up if nothing spoken at all
    const MIN_SPEECH_MS      = 250;    // ignore micro-blips

    const startedAt   = performance.now();
    let speechStartAt = 0;
    let lastLoudAt    = 0;
    let everSpoke     = false;

    return new Promise((resolve) => {
      const tick = () => {
        if (cancelledRef.current) return resolve(null);
        analyser.getByteTimeDomainData(buf);
        // Compute RMS on time-domain samples (centered around 128)
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        const now = performance.now();

        if (rms >= SPEECH_THRESHOLD) {
          if (!everSpoke) speechStartAt = now;
          everSpoke  = true;
          lastLoudAt = now;
        }

        const elapsed = now - startedAt;
        if (everSpoke && (now - lastLoudAt) > SILENCE_HANG_MS &&
            (now - speechStartAt) > MIN_SPEECH_MS) {
          return finish(resolve, true);
        }
        if (!everSpoke && elapsed > MAX_LISTEN_MS) {
          return finish(resolve, false);
        }
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    });
  }, [setState]);

  function finish(resolve, didSpeak) {
    const recorder = recorderRef.current;
    cancelAnimationFrame(rafRef.current);
    try { ctxRef.current?.close(); } catch {}
    streamRef.current?.getTracks().forEach((t) => t.stop());
    ctxRef.current = streamRef.current = analyserRef.current = null;

    if (!recorder || recorder.state === 'inactive') return resolve(null);

    recorder.onstop = async () => {
      if (!didSpeak || !chunksRef.current.length) return resolve(null);
      const blob = new Blob(chunksRef.current, { type: mimeRef.current });
      const buffer = await blob.arrayBuffer();
      try {
        const text = await window.jarvis.transcribeAudio(buffer, mimeRef.current);
        resolve((text || '').trim() || null);
      } catch (err) {
        console.warn('[VoiceLoop] transcribe failed:', err);
        resolve(null);
      }
    };
    recorder.stop();
  }

  // ── speak (TTS) ─────────────────────────────────────────────────────────
  const speakAndWait = useCallback(async (text) => {
    if (!text || !text.trim()) return;
    setState('speaking');
    try {
      const b64 = await window.jarvis.speak(text);
      if (!b64) return;
      const audio = new Audio('data:audio/mpeg;base64,' + b64);
      audioElRef.current = audio;
      await new Promise((resolve) => {
        audio.onended = resolve;
        audio.onerror = resolve;
        audio.play().catch(resolve);
      });
    } catch (err) {
      console.warn('[VoiceLoop] TTS failed:', err);
    }
  }, [setState]);

  // ── Claude turn (send transcript, wait for full response) ──────────────
  const askClaude = useCallback((prompt) => new Promise((resolve) => {
    let full = '';
    const offChunk = window.jarvis.onChunk?.((c) => { full += c; });
    const onDone = ({ fullText }) => {
      try { window.jarvis.offStream?.(); } catch {}
      resolve((fullText || full || '').trim());
    };
    window.jarvis.onDone?.(onDone);
    window.jarvis.sendMessage(prompt);
  }), []);

  // ── master loop ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !window.jarvis) return;
    cancelledRef.current = false;

    async function loop() {
      while (!cancelledRef.current) {
        const text = await listenOnce();
        if (cancelledRef.current) break;
        if (!text) { continue; }   // silence — listen again
        setState('processing');

        // Voice commands take priority over Claude
        if (matchOpenChat(text))  { onOpenChat?.();  setState('idle');      break; }
        if (matchCloseChat(text)) { onCloseChat?.(); setState('idle');      break; }

        const reply = await askClaude(text);
        if (cancelledRef.current) break;
        await speakAndWait(reply);
      }
    }
    loop();
    return () => { cancelledRef.current = true; stopAll(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return null;
}
