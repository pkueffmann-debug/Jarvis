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

    console.log('[VoiceLoop] step 1: requesting getUserMedia…');
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
    } catch (err) {
      console.warn('[VoiceLoop] step 1 FAIL — mic permission/access:', err?.name, err?.message);
      setState('idle');
      return null;
    }
    console.log('[VoiceLoop] step 1 OK — got stream, tracks:', stream.getAudioTracks().map(t => t.label));

    if (cancelledRef.current) { stream.getTracks().forEach((t) => t.stop()); return null; }
    streamRef.current = stream;

    // VAD setup
    console.log('[VoiceLoop] step 2: creating AudioContext…');
    const ctx = new AudioContext();
    ctxRef.current = ctx;
    const src = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 1024;
    src.connect(analyser);
    analyserRef.current = analyser;
    const buf = new Uint8Array(analyser.frequencyBinCount);
    console.log('[VoiceLoop] step 2 OK — AudioContext state:', ctx.state);

    // Recorder
    console.log('[VoiceLoop] step 3: creating MediaRecorder…');
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'].find(
      (m) => MediaRecorder.isTypeSupported(m)
    ) || 'audio/webm';
    mimeRef.current = mime;
    let recorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: mime });
    } catch (err) {
      console.warn('[VoiceLoop] step 3 FAIL — MediaRecorder ctor:', err?.message);
      return null;
    }
    recorderRef.current = recorder;
    chunksRef.current = [];
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.start(80);
    console.log('[VoiceLoop] step 3 OK — recording, mime:', mime);

    // VAD loop. Threshold is conservative — user's mic was very quiet in
    // earlier tests. Adapt: track noise floor in the first ~400ms and set
    // threshold to noise_floor * 3 (min 0.012, max 0.05).
    const SILENCE_HANG_MS = 1500;
    const MAX_LISTEN_MS   = 10000;
    const MIN_SPEECH_MS   = 250;
    const CALIBRATE_MS    = 400;
    const MIN_THRESHOLD   = 0.012;
    const MAX_THRESHOLD   = 0.05;

    const startedAt   = performance.now();
    let speechStartAt = 0;
    let lastLoudAt    = 0;
    let everSpoke     = false;
    let noiseFloor    = 0;
    let calibFrames   = 0;
    let threshold     = MAX_THRESHOLD;  // conservative until calibrated
    let logEvery      = 0;

    console.log('[VoiceLoop] listen start');

    return new Promise((resolve) => {
      const tick = () => {
        if (cancelledRef.current) return resolve(null);
        analyser.getByteTimeDomainData(buf);
        let sum = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = (buf[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buf.length);
        const now = performance.now();
        const elapsed = now - startedAt;

        // Calibrate noise floor in the first CALIBRATE_MS
        if (elapsed < CALIBRATE_MS) {
          noiseFloor = (noiseFloor * calibFrames + rms) / (calibFrames + 1);
          calibFrames++;
          if (elapsed >= CALIBRATE_MS - 16) {
            threshold = Math.min(MAX_THRESHOLD, Math.max(MIN_THRESHOLD, noiseFloor * 3));
            console.log(`[VoiceLoop] calibrated noise=${noiseFloor.toFixed(4)} threshold=${threshold.toFixed(4)}`);
          }
        }

        // Periodic debug print so user can see what's happening
        logEvery++;
        if (logEvery % 30 === 0) {
          console.log(`[VoiceLoop] rms=${rms.toFixed(4)} thr=${threshold.toFixed(4)} spoke=${everSpoke} elapsed=${(elapsed/1000).toFixed(1)}s`);
        }

        if (rms >= threshold) {
          if (!everSpoke) speechStartAt = now;
          everSpoke  = true;
          lastLoudAt = now;
        }

        if (everSpoke && (now - lastLoudAt) > SILENCE_HANG_MS &&
            (now - speechStartAt) > MIN_SPEECH_MS) {
          console.log('[VoiceLoop] silence detected → submit');
          return finish(resolve, true);
        }
        if (!everSpoke && elapsed > MAX_LISTEN_MS) {
          console.log('[VoiceLoop] no speech in MAX_LISTEN_MS → retry');
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
      console.log(`[VoiceLoop] transcribing ${buffer.byteLength} bytes…`);
      try {
        const text = await window.jarvis.transcribeAudio(buffer, mimeRef.current);
        console.log(`[VoiceLoop] transcript: "${text}"`);
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
    if (!text || !text.trim()) { console.log('[VoiceLoop] speak: empty text — skip'); return; }
    setState('speaking');
    console.log(`[VoiceLoop] speak: requesting TTS for ${text.length} chars`);
    try {
      const b64 = await window.jarvis.speak(text);
      if (!b64) {
        console.warn('[VoiceLoop] speak: TTS returned NULL — ElevenLabs key/voice missing or rejected. Skipping audio.');
        return;
      }
      console.log(`[VoiceLoop] speak: got ${b64.length} chars of base64 audio, playing…`);
      const audio = new Audio('data:audio/mpeg;base64,' + b64);
      audioElRef.current = audio;
      await new Promise((resolve) => {
        audio.onended = () => { console.log('[VoiceLoop] speak: audio ended'); resolve(); };
        audio.onerror = (e) => { console.warn('[VoiceLoop] speak: audio error', e); resolve(); };
        audio.play()
          .then(() => console.log('[VoiceLoop] speak: audio.play() resolved (playback started)'))
          .catch((err) => { console.warn('[VoiceLoop] speak: audio.play() rejected', err?.message); resolve(); });
      });
    } catch (err) {
      console.warn('[VoiceLoop] speak: exception', err);
    }
  }, [setState]);

  // ── Claude turn (send transcript, wait for full response) ──────────────
  const askClaude = useCallback((prompt) => new Promise((resolve) => {
    console.log(`[VoiceLoop] → Claude: "${prompt}"`);
    let full = '';
    // Clear any leftover listeners from previous turns
    try { window.jarvis.offStream?.(); } catch {}
    window.jarvis.onChunk?.((c) => { full += c; });
    window.jarvis.onDone?.(({ fullText }) => {
      const reply = (fullText || full || '').trim();
      console.log(`[VoiceLoop] ← Claude (${reply.length} chars): "${reply.slice(0, 100)}${reply.length > 100 ? '…' : ''}"`);
      try { window.jarvis.offStream?.(); } catch {}
      resolve(reply);
    });
    window.jarvis.onError?.((msg) => {
      console.warn('[VoiceLoop] Claude error:', msg);
      try { window.jarvis.offStream?.(); } catch {}
      resolve('');
    });
    window.jarvis.sendMessage(prompt);
  }), []);

  // ── master loop ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !window.jarvis) return;
    cancelledRef.current = false;

    async function loop() {
      console.log('[VoiceLoop] master loop started');
      while (!cancelledRef.current) {
        const text = await listenOnce();
        if (cancelledRef.current) break;
        if (!text) { continue; }   // silence — listen again
        setState('processing');

        // Voice commands take priority over Claude
        if (matchOpenChat(text))  { console.log('[VoiceLoop] cmd: open chat');  onOpenChat?.();  setState('idle'); break; }
        if (matchCloseChat(text)) { console.log('[VoiceLoop] cmd: close chat'); onCloseChat?.(); setState('idle'); break; }

        const reply = await askClaude(text);
        if (cancelledRef.current) break;
        if (reply) await speakAndWait(reply);
      }
      console.log('[VoiceLoop] master loop ended');
    }
    loop();
    return () => { cancelledRef.current = true; stopAll(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return null;
}
