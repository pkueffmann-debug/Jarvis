import React, { useState, useRef, useEffect, useCallback } from 'react';
import Voice from './Voice';

const INITIAL_MESSAGES = [
  {
    id: 1,
    role: 'jarvis',
    content: 'Hallo! Ich bin JARVIS, dein persönlicher KI-Assistent. Wie kann ich dir helfen?',
    streaming: false,
  },
];

// ── Sub-components ─────────────────────────────────────────────────────────

function Avatar() {
  return (
    <div
      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white mr-2 mt-0.5 shrink-0"
      style={{ background: 'linear-gradient(135deg, #6366F1 0%, #818CF8 100%)' }}
    >
      J
    </div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex animate-msg-in mb-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && <Avatar />}
      <div
        className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
          isUser
            ? 'bg-white text-[#0A0A0F] rounded-br-sm font-medium'
            : 'bg-[#1A1A26] text-white border border-[rgba(99,102,241,0.25)] rounded-bl-sm'
        }`}
      >
        {msg.content}
        {msg.streaming && (
          <span className="inline-block w-[2px] h-[14px] bg-[#818CF8] ml-0.5 align-middle animate-blink" />
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center mb-3">
      <Avatar />
      <div className="bg-[#1A1A26] border border-[rgba(99,102,241,0.25)] rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
        <span className="w-1.5 h-1.5 rounded-full bg-subtext animate-typing-1 block" />
        <span className="w-1.5 h-1.5 rounded-full bg-subtext animate-typing-2 block" />
        <span className="w-1.5 h-1.5 rounded-full bg-subtext animate-typing-3 block" />
      </div>
    </div>
  );
}

function ToolStatusBadge({ status }) {
  if (!status) return null;
  return (
    <div className="flex items-center gap-2 mx-8 mb-3 px-3 py-1.5 rounded-lg animate-msg-in"
         style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
      <div className="w-3 h-3 rounded-full border-2 border-[#6366F1] border-t-transparent animate-spin shrink-0" />
      <span className="text-[#818CF8] text-xs">{status}</span>
    </div>
  );
}

function GmailBanner({ onConnect, connecting }) {
  return (
    <div className="mx-3 mb-3 px-3 py-2.5 rounded-xl flex items-center justify-between gap-2 animate-msg-in"
         style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
      <div>
        <p className="text-success text-xs font-medium">Gmail nicht verbunden</p>
        <p className="text-subtext text-[11px]">Für Email-Zugriff einmalig autorisieren</p>
      </div>
      <button
        onClick={onConnect}
        disabled={connecting}
        className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-opacity disabled:opacity-50"
        style={{ background: 'linear-gradient(135deg, #6366F1 0%, #818CF8 100%)' }}
      >
        {connecting ? 'Öffnet…' : 'Verbinden'}
      </button>
    </div>
  );
}

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function SpeakerIcon({ on }) {
  return on ? (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  ) : (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}

// ── Main Chat ──────────────────────────────────────────────────────────────

export default function Chat() {
  const [messages,    setMessages]   = useState(INITIAL_MESSAGES);
  const [input,       setInput]      = useState('');
  const [busy,        setBusy]       = useState(false);
  const [streaming,   setStreaming]  = useState(false);
  const [speaking,    setSpeaking]   = useState(false);
  const [toolStatus,  setToolStatus] = useState('');
  const [ttsOn,       setTtsOn]      = useState(() => localStorage.getItem('jarvis-tts') !== 'false');
  const [gmailState,  setGmailState] = useState({ configured: false, authenticated: false });
  const [gmailConnecting, setGmailConnecting] = useState(false);

  const bottomRef      = useRef(null);
  const inputRef       = useRef(null);
  const streamTextRef  = useRef('');
  const ttsOnRef       = useRef(ttsOn);
  const audioRef       = useRef(null);

  useEffect(() => { ttsOnRef.current = ttsOn; }, [ttsOn]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, busy, toolStatus]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Check Gmail status on mount
  useEffect(() => {
    if (!window.jarvis) return;
    window.jarvis.gmailStatus().then(setGmailState).catch(() => {});
  }, []);

  function toggleTTS() {
    const next = !ttsOn;
    setTtsOn(next);
    localStorage.setItem('jarvis-tts', String(next));
    if (!next && audioRef.current) { audioRef.current.pause(); audioRef.current = null; setSpeaking(false); }
  }

  async function connectGmail() {
    setGmailConnecting(true);
    try {
      const result = await window.jarvis.gmailConnect();
      if (result.success) {
        setGmailState({ configured: true, authenticated: true });
        setMessages((prev) => [...prev, {
          id: Date.now(), role: 'jarvis',
          content: '✅ Gmail erfolgreich verbunden! Du kannst jetzt Emails lesen und senden.',
          streaming: false,
        }]);
      } else {
        setMessages((prev) => [...prev, {
          id: Date.now(), role: 'jarvis',
          content: `⚠️ Gmail-Verbindung fehlgeschlagen: ${result.error}`,
          streaming: false,
        }]);
      }
    } finally {
      setGmailConnecting(false);
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

    setMessages((prev) => [...prev, { id: Date.now(), role: 'user', content, streaming: false }]);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; setSpeaking(false); }

    if (!window.jarvis) {
      // Browser preview
      setTimeout(() => {
        setBusy(false);
        const id = Date.now() + 1;
        setMessages((p) => [...p, { id, role: 'jarvis', content: '', streaming: true }]);
        setStreaming(true);
        const words = ['Phase 4 Preview: ', 'Gmail Tool Use ', 'ist aktiv 📬'];
        let i = 0;
        const t = setInterval(() => {
          if (i >= words.length) { clearInterval(t); setMessages((p) => p.map((m) => m.id === id ? { ...m, streaming: false } : m)); setStreaming(false); return; }
          setMessages((p) => p.map((m) => m.id === id ? { ...m, content: m.content + words[i] } : m));
          i++;
        }, 250);
      }, 500);
      return;
    }

    window.jarvis.onToolStatus((status) => {
      setBusy(false);
      setToolStatus(status);
    });

    window.jarvis.onChunk((chunk) => {
      streamTextRef.current += chunk;
      setBusy(false);
      setToolStatus('');
      setStreaming(true);
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.streaming) return prev.map((m) => m.id === last.id ? { ...m, content: m.content + chunk } : m);
        const id = Date.now();
        return [...prev, { id, role: 'jarvis', content: chunk, streaming: true }];
      });
    });

    window.jarvis.onDone(({ fullText } = {}) => {
      setMessages((prev) => prev.map((m) => m.streaming ? { ...m, streaming: false } : m));
      setStreaming(false);
      setBusy(false);
      setToolStatus('');
      window.jarvis.offStream();
      inputRef.current?.focus();
      const ttsText = fullText || streamTextRef.current;
      if (ttsText) playTTS(ttsText);
    });

    window.jarvis.onError((errMsg) => {
      setBusy(false);
      setStreaming(false);
      setToolStatus('');
      setMessages((prev) => {
        const err = { id: Date.now(), role: 'jarvis', content: `⚠️ ${errMsg}`, streaming: false };
        return prev.some((m) => m.streaming) ? prev.map((m) => m.streaming ? err : m) : [...prev, err];
      });
      window.jarvis.offStream();
    });

    window.jarvis.sendMessage(content);
  }, [input, busy, streaming]); // eslint-disable-line

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }

  const isDisabled  = busy || streaming;
  const statusLabel = speaking ? 'Spricht…' : streaming ? 'Antwortet…' : toolStatus ? 'Arbeitet…' : 'Active';
  const showGmailBanner = window.jarvis && gmailState.configured && !gmailState.authenticated;

  return (
    <div
      className="flex flex-col w-[380px] h-[600px] rounded-2xl overflow-hidden"
      style={{
        background: '#0A0A0F',
        boxShadow: '0 0 0 1px rgba(99,102,241,0.2), 0 24px 64px rgba(0,0,0,0.85), 0 0 48px rgba(99,102,241,0.12)',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-3.5 shrink-0"
        style={{ background: '#0D0D15', borderBottom: '1px solid rgba(99,102,241,0.15)', WebkitAppRegion: 'drag' }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
               style={{ background: 'linear-gradient(135deg, #6366F1 0%, #818CF8 100%)' }}>J</div>
          <span className="text-white font-semibold tracking-[0.12em] text-sm">JARVIS</span>
        </div>

        <div className="flex items-center gap-2.5" style={{ WebkitAppRegion: 'no-drag' }}>
          <button onClick={toggleTTS}
                  title={ttsOn ? 'Stimme an' : 'Stimme aus'}
                  className={`w-6 h-6 rounded flex items-center justify-center transition-colors hover:text-white ${ttsOn ? 'text-[#818CF8]' : 'text-subtext/40'}`}>
            <SpeakerIcon on={ttsOn} />
          </button>
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${speaking ? 'bg-[#818CF8]' : 'bg-success'} animate-pulse-dot`} />
            <span className="text-subtext text-[11px] w-[64px]">{statusLabel}</span>
          </div>
          <button onClick={() => window.jarvis?.closeWindow()}
                  className="w-5 h-5 rounded flex items-center justify-center text-subtext hover:text-white hover:bg-white/10 transition-colors">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Messages ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2">
        {messages.map((msg) => <Message key={msg.id} msg={msg} />)}
        {toolStatus && <ToolStatusBadge status={toolStatus} />}
        {busy && !toolStatus && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* ── Gmail connect banner ───────────────────────────────────── */}
      {showGmailBanner && (
        <GmailBanner onConnect={connectGmail} connecting={gmailConnecting} />
      )}

      {/* ── Input ──────────────────────────────────────────────────── */}
      <div className="shrink-0 px-3 py-3" style={{ borderTop: '1px solid rgba(99,102,241,0.12)' }}>
        <div className="flex items-center gap-2 rounded-xl px-3 py-2"
             style={{ background: '#13131A', border: '1px solid rgba(99,102,241,0.2)' }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={isDisabled ? 'JARVIS arbeitet…' : 'Frag JARVIS etwas…'}
            disabled={isDisabled}
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder-subtext/50 disabled:opacity-60"
            style={{ WebkitAppRegion: 'no-drag' }}
          />
          <Voice onTranscript={sendMessage} disabled={isDisabled} />
          <button
            onClick={() => sendMessage()}
            disabled={!input.trim() || isDisabled}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: input.trim() && !isDisabled ? 'linear-gradient(135deg, #6366F1 0%, #818CF8 100%)' : 'rgba(99,102,241,0.2)',
              WebkitAppRegion: 'no-drag',
            }}
          >
            <SendIcon />
          </button>
        </div>
        <p className="text-center text-subtext/40 text-[10px] mt-2">⌘⇧J öffnen · Halten = Spracheingabe</p>
      </div>
    </div>
  );
}
