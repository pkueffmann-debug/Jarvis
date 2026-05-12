import React, { useState, useCallback, useEffect, useRef } from 'react';
import Chat from './Chat';
import Settings from './Settings';
import WakeWord from './WakeWord';
import Paywall from './Paywall';
import HUD from './HUD';
import AuthScreen from './AuthScreen';
import { getSession, onAuthStateChange } from './auth';

const W = 900;
const H = 900;
const HUD_H = 380;   // top HUD section height
const CHAT_H = H - HUD_H - 1; // bottom chat section height (1px divider)

export default function App() {
  const [mode,          setMode]          = useState('loading'); // loading | auth | main
  const [session,       setSession]       = useState(null);
  const [ttsOn,         setTtsOn]         = useState(() => localStorage.getItem('jarvis-tts') !== 'false');
  const [wakeWordOn,    setWakeWordOn]     = useState(() => localStorage.getItem('jarvis-wakeword') === 'true');
  const [wakeFlash,     setWakeFlash]     = useState(false);
  const [licenseStatus, setLicenseStatus] = useState(null);
  const [showSettings,  setShowSettings]  = useState(false);
  const [showPaywall,   setShowPaywall]   = useState(false);
  const [statusMap,     setStatusMap]     = useState({
    gmail: false, calendar: false, voice: true, memory: true, screen: true, system: true,
  });

  const chatInputRef = useRef(null);

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
  const handleWakeDetected = useCallback(() => {
    setWakeFlash(true);
    setTimeout(() => setWakeFlash(false), 600);
    chatInputRef.current?.focus();
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
        // Subtle radial glow behind HUD
        background: 'radial-gradient(ellipse 600px 320px at 50% 50%, rgba(99,102,241,0.06) 0%, transparent 70%)',
      }}>
        <HUD
          statusMap={statusMap}
          onFocusChat={() => chatInputRef.current?.focus()}
        />
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
