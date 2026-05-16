import React, { useState, useCallback, useEffect, useRef } from 'react';
import Chat from './Chat';
import Settings from './Settings';
import WakeWord from './WakeWord';
import Paywall from './Paywall';
import HudCompact from './HudCompact';
import HudWindow from './HudWindow';
import VoiceLoop from './VoiceLoop';
import AuthScreen from './AuthScreen';
import { getSession, onAuthStateChange } from './auth';

// Chat layout dimensions (must match WINDOW_SIZES.chat in main.js)
const W = 900;
const H = 700;
const HUD_H = 320;   // top HUD section height in chat mode
const CHAT_H = H - HUD_H - 1; // bottom chat section height (1px divider)

export default function App() {
  const [mode,          setMode]          = useState('loading'); // loading | auth | main
  const [windowMode,    setWindowMode]    = useState('chat');    // chat | hud | map
  const [session,       setSession]       = useState(null);
  const [ttsOn,         setTtsOn]         = useState(() => localStorage.getItem('jarvis-tts') !== 'false');
  const [wakeWordOn,    setWakeWordOn]     = useState(() => localStorage.getItem('jarvis-wakeword') === 'true');
  const [wakeFlash,     setWakeFlash]     = useState(false);
  const [voiceState,    setVoiceState]    = useState('idle'); // idle | listening | processing | speaking
  const [licenseStatus, setLicenseStatus] = useState(null);
  const [showSettings,  setShowSettings]  = useState(false);
  const [showPaywall,   setShowPaywall]   = useState(false);
  const [mapData,       setMapData]       = useState(null);    // { city, lat, lon } | null
  const [statusMap,     setStatusMap]     = useState({
    gmail: false, calendar: false, voice: true, memory: true, screen: true, system: true,
  });

  const chatInputRef = useRef(null);

  // ── Window mode sync ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!window.jarvis?.getWindowMode) return;
    window.jarvis.getWindowMode().then((m) => {
      console.log('[App] initial windowMode =', m);
      if (m) setWindowMode(m);
    }).catch(() => {});
    window.jarvis.onWindowModeChanged?.((m) => {
      console.log('[App] window-mode-changed received →', m);
      setWindowMode(m);
    });
    return () => window.jarvis.offWindowModeChanged?.();
  }, []);

  useEffect(() => {
    console.log('[App] windowMode state is now:', windowMode);
  }, [windowMode]);

  const expandToChat = useCallback(() => {
    window.jarvis?.setWindowMode?.('chat');
    setWindowMode('chat');
    setMapData(null);
  }, []);
  const collapseToHud = useCallback(() => {
    window.jarvis?.setWindowMode?.('hud');
    setWindowMode('hud');
  }, []);
  const closeWindow = useCallback(() => {
    window.jarvis?.closeWindow?.();
  }, []);
  const openMap = useCallback(({ city, lat, lon }) => {
    setMapData({ city, lat, lon });
    window.jarvis?.setWindowMode?.('map');
    setWindowMode('map');
  }, []);
  const closeMap = useCallback(() => {
    setMapData(null);
    window.jarvis?.setWindowMode?.('hud');
    setWindowMode('hud');
  }, []);

  // ── Boot ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function boot() {
      try {
        const sess = await getSession();
        setSession(sess);
        if (sess) {
          await startLoggedIn();
        } else {
          const cfg = await window.jarvis?.supabaseConfig?.().catch(() => null);
          if (cfg?.url) setMode('auth');
          else          await startLoggedIn();
        }
      } catch {
        await startLoggedIn();
      }
    }
    boot();

    let unsub;
    onAuthStateChange((sess) => setSession(sess))
      .then(({ data }) => { unsub = data?.subscription; })
      .catch(() => {});
    return () => unsub?.unsubscribe?.();
  }, []); // eslint-disable-line

  async function startLoggedIn() {
    try {
      const status = await window.jarvis.licenseStatus();
      setLicenseStatus(status);
      if (status.status === 'expired') setShowPaywall(true);
    } catch {}
    setMode('main');
  }

  // ── Google → HUD segments ─────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'main') return;
    window.jarvis?.googleStatus?.().then(g => {
      setStatusMap(s => ({ ...s, gmail: g.authenticated, calendar: g.authenticated }));
    }).catch(() => {});
  }, [mode]);

  // ── Paywall listener ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!window.jarvis) return;
    window.jarvis.onPaywall((status) => { setLicenseStatus(status); setShowPaywall(true); });
    return () => window.jarvis.offPaywall?.();
  }, []);

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
  const lastGreetingAtRef = useRef(0);
  const handleWakeDetected = useCallback(async () => {
    console.log('[App] wake-word-detected — switching to HUD mode');
    setWakeFlash(true);
    setTimeout(() => setWakeFlash(false), 600);
    chatInputRef.current?.focus();
    setMapData(null);
    window.jarvis?.setWindowMode?.('hud').catch(() => {});
    setWindowMode('hud');

    // Greet on wake-word so the user gets immediate audible feedback.
    // Rate-limit to once every 5s so rapid OWW false-positives don't spam.
    const now = Date.now();
    if (now - lastGreetingAtRef.current < 5000) return;
    lastGreetingAtRef.current = now;
    try {
      const b64 = await window.jarvis.speak('Ja, Sir?');
      if (b64) {
        const audio = new Audio('data:audio/mpeg;base64,' + b64);
        audio.play().catch(() => {});
      }
    } catch {}
  }, []);

  async function handlePaywallActivated() {
    const status = await window.jarvis.licenseStatus().catch(() => null);
    setLicenseStatus(status);
    setShowPaywall(false);
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (mode === 'loading') {
    return (
      <div style={{ width: W, height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent' }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #6366F1', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // ── Auth ───────────────────────────────────────────────────────────────────
  if (mode === 'auth') {
    return (
      <div style={{ width: W, height: H, background: '#000011', borderRadius: 20, overflow: 'hidden' }}>
        <AuthScreen onAuthenticated={(sess) => { setSession(sess); startLoggedIn(); }} />
      </div>
    );
  }

  // ── Compact HUD-only window mode (with optional Map) ──────────────────────
  if (windowMode === 'hud' || windowMode === 'map') {
    return (
      <>
        <WakeWord enabled={wakeWordOn} onDetected={handleWakeDetected} />
        <VoiceLoop
          enabled
          onState={setVoiceState}
          onOpenChat={expandToChat}
          onCloseChat={closeWindow}
          onOpenMap={openMap}
          onCloseMap={closeMap}
        />
        <HudWindow
          voiceState={voiceState}
          mapData={windowMode === 'map' ? mapData : null}
          onClose={closeWindow}
          onCloseMap={closeMap}
        />
      </>
    );
  }

  // ── Main: combined HUD + Chat ──────────────────────────────────────────────
  return (
    <div style={{
      position: 'relative',
      width: W, height: H,
      background: 'linear-gradient(160deg, #080810 0%, #050508 100%)',
      borderRadius: 20,
      overflow: 'hidden',
      boxShadow: '0 0 0 1px rgba(99,102,241,0.15), 0 40px 120px rgba(0,0,0,0.95), 0 0 80px rgba(99,102,241,0.06)',
    }}>
      <WakeWord enabled={wakeWordOn} onDetected={handleWakeDetected} />

      {/* ── HUD section ─────────────────────────────────────────────── */}
      <div style={{
        height: HUD_H,
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'radial-gradient(ellipse 600px 320px at 50% 50%, rgba(99,102,241,0.06) 0%, transparent 70%)',
      }}>
        <HudCompact size={HUD_H - 20} state={voiceState} />
        {/* "Back to HUD" pill — top-left, only visible in chat mode */}
        <button
          onClick={collapseToHud}
          title="Zur kompakten HUD wechseln"
          style={{
            position: 'absolute', top: 12, left: 12,
            padding: '4px 10px', fontSize: 10, letterSpacing: 1.5, fontWeight: 700,
            color: 'rgba(99,102,241,0.7)', background: 'rgba(99,102,241,0.06)',
            border: '1px solid rgba(99,102,241,0.25)', borderRadius: 99,
            cursor: 'pointer', WebkitAppRegion: 'no-drag',
            fontFamily: 'Inter, sans-serif',
          }}
        >HUD ↑</button>
      </div>

      {/* ── Divider ─────────────────────────────────────────────────── */}
      <div style={{ height: 1, background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.25) 20%, rgba(0,212,255,0.15) 50%, rgba(99,102,241,0.25) 80%, transparent)' }} />

      {/* ── Chat section ────────────────────────────────────────────── */}
      <div style={{ height: CHAT_H, overflow: 'hidden' }}>
        <Chat
          ttsOn={ttsOn}
          onToggleTTS={toggleTTS}
          onOpenSettings={() => setShowSettings(true)}
          wakeFlash={wakeFlash}
          licenseStatus={licenseStatus}
          onOpenPaywall={() => setShowPaywall(true)}
          inputRef={chatInputRef}
          width={W}
          height={CHAT_H}
        />
      </div>

      {/* ── Settings overlay ────────────────────────────────────────── */}
      {showSettings && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50 }}>
          <Settings
            onClose={() => setShowSettings(false)}
            ttsOn={ttsOn}
            onToggleTTS={toggleTTS}
            wakeWordOn={wakeWordOn}
            onToggleWakeWord={toggleWakeWord}
          />
        </div>
      )}

      {/* ── Paywall overlay ─────────────────────────────────────────── */}
      {showPaywall && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 50 }}>
          <Paywall
            licenseStatus={licenseStatus}
            onActivated={handlePaywallActivated}
            onContinueFree={() => setShowPaywall(false)}
          />
        </div>
      )}
    </div>
  );
}
