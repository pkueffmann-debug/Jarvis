import React, { useState } from 'react';
import Chat from './Chat';
import Settings from './Settings';

export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [ttsOn, setTtsOn] = useState(() => localStorage.getItem('jarvis-tts') !== 'false');

  function toggleTTS(val) {
    const next = val ?? !ttsOn;
    setTtsOn(next);
    localStorage.setItem('jarvis-tts', String(next));
  }

  return (
    <div className="relative w-[380px] h-[600px]">
      <Chat
        ttsOn={ttsOn}
        onToggleTTS={toggleTTS}
        onOpenSettings={() => setShowSettings(true)}
      />
      {showSettings && (
        <Settings
          onClose={() => setShowSettings(false)}
          ttsOn={ttsOn}
          onToggleTTS={toggleTTS}
        />
      )}
    </div>
  );
}
