import React, { useState, useRef, useCallback, useEffect } from 'react';

// ── Icons ──────────────────────────────────────────────────────────────────

function MicIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

function Spinner() {
  return (
    <div className="w-3.5 h-3.5 rounded-full border-2 border-white/20 border-t-white animate-spin" />
  );
}

function WaveformBars() {
  return (
    <div className="flex items-center gap-[2px] h-4">
      {[0, 1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className="block w-[2px] rounded-full bg-red-400"
          style={{ animation: `waveform-bar 0.5s ${i * 0.09}s ease-in-out infinite alternate` }}
        />
      ))}
    </div>
  );
}

// ── Voice component ────────────────────────────────────────────────────────

export default function Voice({ onTranscript, disabled }) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef(null);
  const chunksRef   = useRef([]);
  const mimeRef     = useRef('audio/webm');

  // Release recording when pointer goes up anywhere on the page
  useEffect(() => {
    if (!recording) return;
    const release = () => stopRecording();
    window.addEventListener('pointerup', release);
    return () => window.removeEventListener('pointerup', release);
  }, [recording]); // eslint-disable-line react-hooks/exhaustive-deps

  const startRecording = useCallback(async (e) => {
    e.preventDefault();
    if (disabled || recording || transcribing) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Pick best supported mimeType
      const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg'].find(
        (m) => MediaRecorder.isTypeSupported(m)
      ) || '';
      mimeRef.current = mime || 'audio/webm';

      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
      recorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.start(80);
      setRecording(true);
    } catch {
      // Mic permission denied — silent fail
    }
  }, [disabled, recording, transcribing]);

  const stopRecording = useCallback(async () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;

    setRecording(false);

    recorder.onstop = async () => {
      const chunks = chunksRef.current;
      if (!chunks.length) return;

      setTranscribing(true);
      try {
        const blob = new Blob(chunks, { type: mimeRef.current });
        const arrayBuffer = await blob.arrayBuffer();

        let text;
        if (window.jarvis) {
          text = await window.jarvis.transcribeAudio(arrayBuffer, mimeRef.current);
        } else {
          // Browser preview fallback
          await new Promise((r) => setTimeout(r, 700));
          text = 'Beispiel-Transkription (Preview)';
        }
        if (text?.trim()) onTranscript(text.trim());
      } catch (err) {
        console.error('[Whisper]', err);
      } finally {
        setTranscribing(false);
      }
    };

    recorder.stop();
    recorder.stream.getTracks().forEach((t) => t.stop());
  }, [onTranscript]);

  const isActive = recording || transcribing;

  return (
    <button
      onPointerDown={startRecording}
      disabled={disabled || transcribing}
      title={recording ? 'Loslassen → Whisper transkribiert' : 'Gedrückt halten zum Sprechen'}
      className={[
        'w-7 h-7 rounded-lg flex items-center justify-center transition-all select-none',
        recording
          ? 'bg-red-500/25 text-red-400 shadow-[0_0_12px_rgba(239,68,68,0.5)]'
          : transcribing
          ? 'bg-white/10 text-white/60 cursor-wait'
          : 'text-subtext hover:text-white hover:bg-white/10',
      ].join(' ')}
      style={{ WebkitAppRegion: 'no-drag' }}
    >
      {transcribing ? <Spinner /> : recording ? <WaveformBars /> : <MicIcon />}
    </button>
  );
}
