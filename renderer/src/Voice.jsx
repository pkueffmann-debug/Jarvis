import React, { useState } from 'react';

function MicIcon({ active }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" fill={active ? 'currentColor' : 'none'} />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

// Phase 3: real Whisper recording — for now a UI stub
export default function Voice({ onTranscript, disabled }) {
  const [recording, setRecording] = useState(false);

  function toggle() {
    if (disabled) return;
    setRecording((r) => !r);
    // Phase 3 will wire up MediaRecorder → Whisper API here
  }

  return (
    <button
      onMouseDown={toggle}
      onMouseUp={toggle}
      disabled={disabled}
      title={recording ? 'Aufnahme läuft…' : 'Spracheingabe (Phase 3)'}
      className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
        recording
          ? 'text-red-400 bg-red-500/20 animate-pulse'
          : 'text-subtext hover:text-white hover:bg-white/10'
      }`}
      style={{ WebkitAppRegion: 'no-drag' }}
    >
      <MicIcon active={recording} />
    </button>
  );
}
