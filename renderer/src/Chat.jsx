import React, { useState, useRef, useEffect, useCallback } from 'react';
import Voice from './Voice';

const WELCOME = [{
  id: 1, role: 'jarvis', streaming: false,
  content: 'Guten Tag, Sir. Ich bin JARVIS — Ihr persönlicher KI-Assistent.\nFragen Sie mich nach Emails, Terminen, Dateien oder allem, was Sie benötigen.',
}];

// ── Arc Reactor pulse logo ─────────────────────────────────────────────────

function ArcReactor({ size = 28, glow = false }) {
  return (
    <div style={{
      width: size, height: size,
      borderRadius: '50%',
      background: 'radial-gradient(circle at 40% 35%, rgba(0,212,255,0.25) 0%, rgba(99,102,241,0.35) 50%, rgba(10,10,20,0.9) 100%)',
      border: `1px solid ${glow ? 'rgba(0,212,255,0.7)' : 'rgba(99,102,241,0.55)'}`,
      boxShadow: glow
        ? '0 0 12px rgba(0,212,255,0.5), 0 0 24px rgba(0,212,255,0.2), inset 0 0 8px rgba(0,212,255,0.15)'
        : '0 0 8px rgba(99,102,241,0.35), inset 0 0 6px rgba(99,102,241,0.1)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
      animation: 'arc-pulse 2.8s ease-in-out infinite',
    }}>
      <span style={{
        fontSize: size * 0.38, fontWeight: 900, letterSpacing: 0,
        background: 'linear-gradient(135deg, #00D4FF 0%, #818CF8 100%)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        filter: 'drop-shadow(0 0 4px rgba(0,212,255,0.6))',
      }}>J</span>
    </div>
  );
}

// ── Message bubble ─────────────────────────────────────────────────────────

function Message({ msg }) {
  const isUser     = msg.role === 'user';
  const isProactive = msg.proactive;
  return (
    <div className={`flex animate-msg-in mb-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="mr-2 mt-0.5 shrink-0">
          <ArcReactor size={22} />
        </div>
      )}
      <div style={{
        maxWidth: '60%',
        padding: '10px 14px',
        borderRadius: isUser ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
        fontSize: 13,
        lineHeight: 1.55,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        ...(isUser ? {
          background: 'linear-gradient(135deg, rgba(99,102,241,0.35) 0%, rgba(0,212,255,0.2) 100%)',
          border: '1px solid rgba(99,102,241,0.4)',
          color: '#fff',
          boxShadow: '0 2px 12px rgba(99,102,241,0.2), inset 0 1px 0 rgba(255,255,255,0.08)',
          backdropFilter: 'blur(12px)',
        } : isProactive ? {
          background: 'rgba(16,185,129,0.07)',
          border: '1px solid rgba(16,185,129,0.3)',
          color: 'rgba(255,255,255,0.9)',
          boxShadow: '0 2px 12px rgba(16,185,129,0.1)',
          backdropFilter: 'blur(12px)',
        } : {
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(99,102,241,0.18)',
          color: 'rgba(255,255,255,0.88)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
          backdropFilter: 'blur(12px)',
        }),
      }}>
        {isProactive && (
          <span style={{ display: 'block', fontSize: 9, color: 'rgba(16,185,129,0.7)', fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 4 }}>
            Proaktiv
          </span>
        )}
        {msg.content}
        {msg.streaming && (
          <span style={{ display: 'inline-block', width: 2, height: 13, background: '#00D4FF', marginLeft: 3, verticalAlign: 'middle', borderRadius: 1, animation: 'blink 1s step-end infinite' }} />
        )}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center mb-3">
      <div className="mr-2 shrink-0"><ArcReactor size={22} /></div>
      <div style={{
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(99,102,241,0.18)',
        borderRadius: '4px 18px 18px 18px', padding: '10px 16px',
        display: 'flex', gap: 5, alignItems: 'center', backdropFilter: 'blur(12px)',
      }}>
        {[0, 1, 2].map(i => (
          <span key={i} style={{
            width: 5, height: 5, borderRadius: '50%',
            background: 'rgba(0,212,255,0.6)',
            display: 'block',
            animation: `typing-dot 1.4s ease-in-out ${i * 0.16}s infinite`,
          }} />
        ))}
      </div>
    </div>
  );
}

function ToolBadge({ status }) {
  if (!status) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      margin: '0 8px 12px', padding: '8px 14px',
      background: 'rgba(99,102,241,0.08)',
      border: '1px solid rgba(99,102,241,0.18)',
      borderRadius: 10, backdropFilter: 'blur(8px)',
    }} className="animate-msg-in">
      <div style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid #6366F1', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
      <span style={{ color: '#818CF8', fontSize: 11 }}>{status}</span>
    </div>
  );
}

function ConfirmDialog({ data, onConfirm, onCancel }) {
  return (
    <div style={{
      margin: '0 12px 8px',
      padding: '14px 16px',
      background: 'rgba(245,158,11,0.07)',
      border: '1px solid rgba(245,158,11,0.28)',
      borderRadius: 14, backdropFilter: 'blur(12px)',
    }} className="animate-msg-in">
      <p style={{ color: '#FBBF24', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>⚠️ Bestätigung erforderlich</p>
      <p style={{ color: 'rgba(255,255,255,0.88)', fontSize: 13, lineHeight: 1.5 }}>{data.message}</p>
      {data.detail && (
        <code style={{ display: 'block', marginTop: 8, fontSize: 11, color: 'rgba(255,255,255,0.5)', background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '6px 10px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
          {data.detail}
        </code>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button onClick={onConfirm} style={{
          padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
          color: '#fff', border: 'none', cursor: 'pointer',
          background: 'linear-gradient(135deg, #6366F1, #00D4FF)',
          boxShadow: '0 0 12px rgba(99,102,241,0.4)',
        }}>✓ Ja</button>
        <button onClick={onCancel} style={{
          padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
          color: 'rgba(255,255,255,0.5)', border: '1px solid rgba(255,255,255,0.1)',
          background: 'rgba(255,255,255,0.06)', cursor: 'pointer',
        }}>✕ Abbrechen</button>
      </div>
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────

const IconSend = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
);
const IconSpeaker = ({ on }) => on ? (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <path d="M19.07 4.93a10 10 0 0 1 0 14.14"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>
  </svg>
) : (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
    <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
  </svg>
);
const IconGear = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
);

function Clock() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' }));
  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' })), 10000);
    return () => clearInterval(t);
  }, []);
  return <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{time}</span>;
}

// ── Main Chat ──────────────────────────────────────────────────────────────

export default function Chat({ ttsOn, onToggleTTS, onOpenSettings, onClose, inputRef: externalInputRef, width = 380, height = 600 }) {
  const [messages,    setMessages]    = useState(WELCOME);
  const [input,       setInput]       = useState('');
  const [busy,        setBusy]        = useState(false);
  const [streaming,   setStreaming]   = useState(false);
  const [speaking,    setSpeaking]    = useState(false);
  const [toolStatus,  setToolStatus]  = useState('');
  const [confirmData, setConfirmData] = useState(null);
  const [actionFeed,  setActionFeed]  = useState([]);
  const [inputFocused, setInputFocused] = useState(false);

  const bottomRef     = useRef(null);
  const inputRef      = externalInputRef || useRef(null); // eslint-disable-line
  const streamTextRef = useRef('');
  const ttsOnRef      = useRef(ttsOn);
  const audioRef      = useRef(null);

  useEffect(() => { ttsOnRef.current = ttsOn; }, [ttsOn]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy, toolStatus]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    if (!window.jarvis) return;
    window.jarvis.onConfirm((data) => setConfirmData(data));
    return () => window.jarvis.offConfirm();
  }, []);

  useEffect(() => {
    if (!window.jarvis) return;
    window.jarvis.onProactiveMessage((text) => {
      setMessages((p) => [...p, { id: Date.now(), role: 'jarvis', content: text, streaming: false, proactive: true }]);
    });
    return () => window.jarvis.offProactive?.();
  }, []);

  function handleConfirm(confirmed) {
    window.jarvis.confirmAction(confirmed);
    setConfirmData(null);
    if (!confirmed) {
      setMessages((p) => [...p, { id: Date.now(), role: 'jarvis', content: 'Abgebrochen.', streaming: false }]);
      setBusy(false); setStreaming(false); setToolStatus('');
      window.jarvis.offStream();
    }
  }

  async function playTTS(text) {
    if (!ttsOnRef.current || !window.jarvis) return;
    try {
      setSpeaking(true);
      const b64 = await window.jarvis.speak(text);
      if (!b64) { setSpeaking(false); return; }
      const audio = new Audio(`data:audio/mpeg;base64,${b64}`);
      audioRef.current = audio;
      audio.onended = audio.onerror = () => { setSpeaking(false); audioRef.current = null; };
      audio.play().catch(() => setSpeaking(false));
    } catch { setSpeaking(false); }
  }

  const sendMessage = useCallback((text) => {
    const content = (text ?? input).trim();
    if (!content || busy || streaming) return;

    setInput('');
    setBusy(true);
    streamTextRef.current = '';
    setMessages((p) => [...p, { id: Date.now(), role: 'user', content, streaming: false }]);

    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; setSpeaking(false); }

    if (!window.jarvis) {
      setTimeout(() => {
        setBusy(false);
        const id = Date.now() + 1;
        setMessages((p) => [...p, { id, role: 'jarvis', content: '', streaming: true }]);
        setStreaming(true);
        const words = ['Alles aktiv, Sir. ', 'Calendar, Memory, Files — ', 'sämtliche Tools sind bereit.'];
        let i = 0;
        const t = setInterval(() => {
          if (i >= words.length) { clearInterval(t); setMessages((p) => p.map((m) => m.id === id ? { ...m, streaming: false } : m)); setStreaming(false); return; }
          setMessages((p) => p.map((m) => m.id === id ? { ...m, content: m.content + words[i] } : m));
          i++;
        }, 280);
      }, 500);
      return;
    }

    window.jarvis.onToolStatus((s) => {
      setBusy(false);
      setToolStatus(s);
      setActionFeed((prev) => [{ id: Date.now(), text: s }, ...prev].slice(0, 5));
    });

    window.jarvis.onChunk((chunk) => {
      streamTextRef.current += chunk;
      setBusy(false); setToolStatus(''); setStreaming(true);
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.streaming) return prev.map((m) => m.id === last.id ? { ...m, content: m.content + chunk } : m);
        return [...prev, { id: Date.now(), role: 'jarvis', content: chunk, streaming: true }];
      });
    });

    window.jarvis.onDone(({ fullText } = {}) => {
      setMessages((p) => p.map((m) => m.streaming ? { ...m, streaming: false } : m));
      setStreaming(false); setBusy(false); setToolStatus('');
      window.jarvis.offStream();
      inputRef.current?.focus();
      playTTS(fullText || streamTextRef.current);
    });

    window.jarvis.onError((msg) => {
      setBusy(false); setStreaming(false); setToolStatus('');
      const err = { id: Date.now(), role: 'jarvis', content: `⚠️ ${msg}`, streaming: false };
      setMessages((p) => p.some((m) => m.streaming) ? p.map((m) => m.streaming ? err : m) : [...p, err]);
      window.jarvis.offStream();
    });

    window.jarvis.sendMessage(content);
  }, [input, busy, streaming]); // eslint-disable-line

  const handleKey = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
  const isDisabled = busy || streaming;
  const statusLabel = speaking ? 'Spricht…' : streaming ? 'Antwortet…' : toolStatus ? 'Arbeitet…' : 'Active';
  const statusColor = speaking ? '#818CF8' : '#10B981';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      width, height,
      overflow: 'hidden',
      background: 'transparent',
    }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'linear-gradient(90deg, rgba(99,102,241,0.06) 0%, rgba(0,212,255,0.03) 100%)',
        borderBottom: '1px solid rgba(99,102,241,0.12)',
        flexShrink: 0,
        WebkitAppRegion: 'drag',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <ArcReactor size={28} glow />
          <div>
            <div style={{ color: '#fff', fontWeight: 700, letterSpacing: '0.12em', fontSize: 13, lineHeight: 1 }}>JARVIS</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, boxShadow: `0 0 6px ${statusColor}`, animation: 'pulse-dot 2s ease-in-out infinite' }} />
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10 }}>{statusLabel}</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, WebkitAppRegion: 'no-drag' }}>
          <Clock />
          <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.08)', margin: '0 2px' }} />

          <button onClick={() => { if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; setSpeaking(false); } onToggleTTS(); }}
                  title={ttsOn ? 'Stimme an' : 'Stimme aus'}
                  style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: ttsOn ? '#818CF8' : 'rgba(255,255,255,0.25)', transition: 'color 0.2s' }}>
            <IconSpeaker on={ttsOn} />
          </button>

          <button onClick={onOpenSettings}
                  style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)', transition: 'color 0.2s' }}>
            <IconGear />
          </button>

          {onClose ? (
            <button onClick={onClose} title="Zurück zum HUD"
                    style={{ width: 26, height: 26, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><path d="M12 8l-4 4 4 4M16 12H8"/>
              </svg>
            </button>
          ) : (
            <button onClick={() => window.jarvis?.closeWindow()}
                    style={{ width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.3)' }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Messages ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px 14px 8px' }}>
        {messages.map((m) => <Message key={m.id} msg={m} />)}
        {toolStatus && <ToolBadge status={toolStatus} />}
        {busy && !toolStatus && <TypingDots />}
        <div ref={bottomRef} />
      </div>

      {/* ── Confirmation dialog ─────────────────────────────────────────── */}
      {confirmData && (
        <ConfirmDialog
          data={confirmData}
          onConfirm={() => handleConfirm(true)}
          onCancel={() => handleConfirm(false)}
        />
      )}

      {/* ── Live Action Feed ────────────────────────────────────────────── */}
      {actionFeed.length > 0 && (
        <div style={{ flexShrink: 0, padding: '0 12px 6px' }}>
          <div style={{ borderRadius: 12, overflow: 'hidden', background: 'rgba(6,6,14,0.8)', border: '1px solid rgba(99,102,241,0.1)' }}>
            {actionFeed.map((a, i) => (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 12px',
                borderTop: i > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                opacity: 1 - i * 0.22,
              }}>
                {i === 0 && <div style={{ width: 7, height: 7, borderRadius: '50%', border: '1.5px solid #6366F1', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />}
                {i > 0  && <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(99,102,241,0.25)', flexShrink: 0 }} />}
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Input ──────────────────────────────────────────────────────── */}
      <div style={{ flexShrink: 0, padding: '10px 12px 12px', borderTop: '1px solid rgba(99,102,241,0.1)' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          borderRadius: 50,
          padding: '8px 8px 8px 16px',
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${inputFocused ? 'rgba(0,212,255,0.45)' : 'rgba(99,102,241,0.2)'}`,
          boxShadow: inputFocused ? '0 0 0 3px rgba(0,212,255,0.06), 0 0 20px rgba(0,212,255,0.08)' : 'none',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          backdropFilter: 'blur(12px)',
        }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder={isDisabled ? 'JARVIS arbeitet…' : 'Frag JARVIS etwas…'}
            disabled={isDisabled}
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: '#fff', fontSize: 13,
              WebkitAppRegion: 'no-drag',
            }}
          />
          <Voice onTranscript={sendMessage} disabled={isDisabled} />
          <button onClick={() => sendMessage()} disabled={!input.trim() || isDisabled}
                  style={{
                    width: 32, height: 32, borderRadius: '50%',
                    border: 'none', cursor: input.trim() && !isDisabled ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff',
                    background: input.trim() && !isDisabled
                      ? 'linear-gradient(135deg, #6366F1 0%, #00D4FF 100%)'
                      : 'rgba(99,102,241,0.15)',
                    boxShadow: input.trim() && !isDisabled ? '0 0 12px rgba(0,212,255,0.3)' : 'none',
                    opacity: !input.trim() || isDisabled ? 0.35 : 1,
                    transition: 'all 0.2s',
                    WebkitAppRegion: 'no-drag',
                    flexShrink: 0,
                  }}>
            <IconSend />
          </button>
        </div>
        <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 10, marginTop: 8 }}>
          ⌘⇧J öffnen · Halten = Spracheingabe
        </p>
      </div>

      {/* ── Keyframe styles (injected once) ────────────────────────────── */}
      <style>{`
        @keyframes arc-pulse {
          0%, 100% { box-shadow: 0 0 8px rgba(99,102,241,0.35), inset 0 0 6px rgba(99,102,241,0.1); }
          50%       { box-shadow: 0 0 14px rgba(0,212,255,0.45), inset 0 0 10px rgba(0,212,255,0.12); }
        }
        @keyframes typing-dot {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.5; }
          30%            { transform: translateY(-4px); opacity: 1; }
        }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes spin  { to { transform: rotate(360deg); } }
        @keyframes pulse-dot {
          0%,100% { opacity:1; transform:scale(1); }
          50%     { opacity:0.6; transform:scale(0.85); }
        }
        @keyframes msg-in {
          from { opacity:0; transform:translateY(6px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .animate-msg-in { animation: msg-in 0.25s ease-out; }
      `}</style>
    </div>
  );
}
