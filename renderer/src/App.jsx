import React, { useState, useCallback, useEffect } from 'react';
import Chat from './Chat';
import Settings from './Settings';
import WakeWord from './WakeWord';
import Paywall from './Paywall';

export default function App() {
  const [showSettings, setShowSettings] = useState(false);
  const [ttsOn,     setTtsOn]     = useState(() => localStorage.getItem('jarvis-tts')      !== 'false');
  const [wakeWordOn, setWakeWordOn] = useState(() => localStorage.getItem('jarvis-wakeword') === 'true');
  const [wakeFlash,  setWakeFlash]  = useState(false);

  const [licenseStatus, setLicenseStatus] = useState(null);
  const [showPaywall,   setShowPaywall]   = useState(false);

  useEffect(() => {
    async function checkLicense() {
      try {
        const status = await window.jarvis.licenseStatus();
        setLicenseStatus(status);
        if (status.status === 'expired') setShowPaywall(true);
      } catch {}
    }
    checkLicense();

    window.jarvis.onPaywall((status) => {
      setLicenseStatus(status);
      setShowPaywall(true);
    });
    return () => window.jarvis.offPaywall();
  }, []);

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

  async function handlePaywallActivated() {
    const status = await window.jarvis.licenseStatus().catch(() => null);
    setLicenseStatus(status);
    setShowPaywall(false);
  }

  function handleContinueFree() {
    setShowPaywall(false);
  }

  return (
    <div className="relative w-[380px] h-[600px]">
      <WakeWord enabled={wakeWordOn} onDetected={handleWakeDetected} />
      <Chat
        ttsOn={ttsOn}
        onToggleTTS={toggleTTS}
        onOpenSettings={() => setShowSettings(true)}
        wakeFlash={wakeFlash}
        licenseStatus={licenseStatus}
        onOpenPaywall={() => setShowPaywall(true)}
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
      {showPaywall && (
        <Paywall
          licenseStatus={licenseStatus}
          onActivated={handlePaywallActivated}
          onContinueFree={handleContinueFree}
        />
      )}
    </div>
  );
}
