import React, { useState, useCallback } from 'react';
import Chat from './Chat';
import Settings from './Settings';
import WakeWord from './WakeWord';

export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [ttsOn,     setTtsOn]     = useState(() => localStorage.getItem('jarvis-tts')      !== 'false');
  const [wakeWordOn, setWakeWordOn] = useState(() => localStorage.getItem('jarvis-wakeword') === 'true');
  const [wakeFlash,  setWakeFlash]  = useState(false);

  function toggleTTS(val) {
    const next = val ?? !ttsOn;
    setTtsOn(next);
    localStorage.setItem('jarvis-tts', String(next));
  }

  function toggleWakeWord(val) {
    const next = val ?? !wakeWordOn;
    setWakeWordOn(next);
    localStorage.setItem('jarvis-wakeword', String(next));
  }

  const handleWakeDetected = useCallback(() => {
    setWakeFlash(true);
    setTimeout(() => setWakeFlash(false), 600);
  }, []);

  return (
    <div className="relative w-[380px] h-[600px]">
      <WakeWord enabled={wakeWordOn} onDetected={handleWakeDetected} />
      <Chat
        ttsOn={ttsOn}
        onToggleTTS={toggleTTS}
        onOpenSettings={() => setShowSettings(true)}
        wakeFlash={wakeFlash}
      />
      {showSettings && (
        <Settings
          onClose={() => setShowSettings(false)}
          ttsOn={ttsOn}
          onToggleTTS={toggleTTS}
          wakeWordOn={wakeWordOn}
          onToggleWakeWord={toggleWakeWord}
        />
      )}
    </div>
  );
}
