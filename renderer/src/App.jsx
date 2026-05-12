import React, { useState, useCallback, useEffect } from 'react';
import Chat from './Chat';
import Settings from './Settings';
import WakeWord from './WakeWord';
import Paywall from './Paywall';
import HUD from './HUD';
import AuthScreen from './AuthScreen';
import { getSession, onAuthStateChange } from './auth';

export default function App() {
  const [mode,       setMode]       = useState('loading'); // loading | auth | hud | chat
  const [session,    setSession]    = useState(null);
  const [ttsOn,      setTtsOn]      = useState(() => localStorage.getItem('jarvis-tts')      !== 'false');
  const [wakeWordOn, setWakeWordOn] = useState(() => localStorage.getItem('jarvis-wakeword') === 'true');
  const [wakeFlash,  setWakeFlash]  = useState(false);
  const [licenseStatus, setLicenseStatus] = useState(null);
  const [showSettings,  setShowSettings]  = useState(false);
  const [showPaywall,   setShowPaywall]   = useState(false);
  const [statusMap,     setStatusMap]     = useState({
    gmail: false, calendar: false, voice: true, memory: true, screen: true, system: true,
  });

  // ── Boot: check auth session ───────────────────────────────────────────────
  useEffect(() => {
    async function boot() {
      try {
        const sess = await getSession();
        setSession(sess);
        if (sess) {
          await startLoggedIn();
        } else {
          // No session — show auth if Supabase is configured
          const cfg = await window.jarvis?.supabaseConfig?.().catch(() => null);
          if (cfg?.url) {
            setMode('auth');
          } else {
            await startLoggedIn(); // no Supabase → skip auth
          }
        }
      } catch {
        await startLoggedIn();
      }
    }
    boot();

    let unsub;
    onAuthStateChange((sess) => {
      setSession(sess);
    }).then(({ data }) => { unsub = data?.subscription; }).catch(() => {});
    return () => unsub?.unsubscribe?.();
  }, []); // eslint-disable-line

  async function startLoggedIn() {
    try {
      const status = await window.jarvis.licenseStatus();
      setLicenseStatus(status);
      if (status.status === 'expired') {
        setMode('hud');
        setShowPaywall(true);
      } else {
        setMode('hud');
        window.jarvis?.setWindowMode?.('hud');
      }
    } catch {
      setMode('hud');
    }
  }

  // ── Google status → HUD segment map ───────────────────────────────────────
  useEffect(() => {
    if (mode !== 'hud' && mode !== 'chat') return;
    window.jarvis?.googleStatus?.().then(g => {
      setStatusMap(s => ({ ...s, gmail: g.authenticated, calendar: g.authenticated }));
    }).catch(() => {});
  }, [mode]);

  // ── License paywall listener ───────────────────────────────────────────────
  useEffect(() => {
    if (!window.jarvis) return;
    window.jarvis.onPaywall((status) => {
      setLicenseStatus(status);
      setShowPaywall(true);
    });
    return () => window.jarvis.offPaywall?.();
  }, []);

  // ── Mode + window resize ───────────────────────────────────────────────────
  function openChat() {
    setMode('chat');
    window.jarvis?.setWindowMode?.('chat');
  }
  function closeToHUD() {
    setMode('hud');
    window.jarvis?.setWindowMode?.('hud');
  }

  // ── Toggles ────────────────────────────────────────────────────────────────
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
    openChat();
  }, []); // eslint-disable-line

  async function handlePaywallActivated() {
    const status = await window.jarvis.licenseStatus().catch(() => null);
    setLicenseStatus(status);
    setShowPaywall(false);
  }

  // ── Loading spinner ────────────────────────────────────────────────────────
  if (mode === 'loading') {
    return (
      <div className="w-[380px] h-[600px] flex items-center justify-center" style={{ background: 'transparent' }}>
        <div className="w-8 h-8 rounded-full border-2 border-[#6366F1] border-t-transparent animate-spin" />
      </div>
    );
  }

  // ── Auth screen ────────────────────────────────────────────────────────────
  if (mode === 'auth') {
    return (
      <div className="relative w-[380px] h-[600px]" style={{ background: 'transparent' }}>
        <AuthScreen onAuthenticated={(sess) => { setSession(sess); startLoggedIn(); }} />
      </div>
    );
  }

  const isHUD = mode === 'hud';

  return (
    <div
      className="relative overflow-hidden transition-all duration-500"
      style={{
        width:      isHUD ? 300 : 380,
        height:     isHUD ? 300 : 600,
        background: 'transparent',
      }}
    >
      <WakeWord enabled={wakeWordOn} onDetected={handleWakeDetected} />

      {/* HUD */}
      <HUD
        visible={isHUD}
        onOpenChat={openChat}
        statusMap={statusMap}
      />

      {/* Chat */}
      {!isHUD && (
        <div className="absolute inset-0 animate-chat-slide-up">
          <Chat
            ttsOn={ttsOn}
            onToggleTTS={toggleTTS}
            onOpenSettings={() => setShowSettings(true)}
            wakeFlash={wakeFlash}
            licenseStatus={licenseStatus}
            onOpenPaywall={() => setShowPaywall(true)}
            onClose={closeToHUD}
          />
        </div>
      )}

      {/* Settings */}
      {showSettings && (
        <Settings
          onClose={() => setShowSettings(false)}
          ttsOn={ttsOn}
          onToggleTTS={toggleTTS}
          wakeWordOn={wakeWordOn}
          onToggleWakeWord={toggleWakeWord}
        />
      )}

      {/* Paywall */}
      {showPaywall && (
        <Paywall
          licenseStatus={licenseStatus}
          onActivated={handlePaywallActivated}
          onContinueFree={() => setShowPaywall(false)}
        />
      )}
    </div>
  );
}
