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
          <span className="inline-block w-[2px] h-[14px] bg-accent-glow ml-0.5 align-middle animate-blink" />
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

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

// ── Main Chat ──────────────────────────────────────────────────────────────

export default function Chat() {
  const [messages, setMessages] = useState(INITIAL_MESSAGES);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);   // true = waiting for first chunk
  const [streaming, setStreaming] = useState(false); // true = chunks arriving
  const bottomRef = useRef(null);
  const inputRef = useRef(null);
  const streamingIdRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const sendMessage = useCallback((text) => {
    const content = (text ?? input).trim();
    if (!content || busy || streaming) return;

    setInput('');
    setBusy(true);

    // Add user bubble
    setMessages((prev) => [
      ...prev,
      { id: Date.now(), role: 'user', content, streaming: false },
    ]);

    if (!window.jarvis) {
      // Browser preview fallback
      setTimeout(() => {
        setBusy(false);
        const id = Date.now() + 1;
        setMessages((prev) => [...prev, { id, role: 'jarvis', content: '', streaming: true }]);
        setStreaming(true);
        streamingIdRef.current = id;
        const words = ['Phase 2 Preview: ', 'Claude API ', 'ist aktiv 🚀'];
        let i = 0;
        const timer = setInterval(() => {
          if (i >= words.length) {
            clearInterval(timer);
            setMessages((prev) => prev.map((m) => m.id === id ? { ...m, streaming: false } : m));
            setStreaming(false);
            return;
          }
          setMessages((prev) => prev.map((m) => m.id === id ? { ...m, content: m.content + words[i] } : m));
          i++;
        }, 200);
      }, 600);
      return;
    }

    // Wire up streaming listeners
    window.jarvis.onChunk((chunk) => {
      setBusy(false);
      setStreaming(true);
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.streaming) {
          return prev.map((m) =>
            m.id === last.id ? { ...m, content: m.content + chunk } : m
          );
        }
        // First chunk — create JARVIS bubble
        const id = Date.now();
        streamingIdRef.current = id;
        return [...prev, { id, role: 'jarvis', content: chunk, streaming: true }];
      });
    });

    window.jarvis.onDone(() => {
      setMessages((prev) =>
        prev.map((m) => m.streaming ? { ...m, streaming: false } : m)
      );
      setStreaming(false);
      setBusy(false);
      window.jarvis.offStream();
      inputRef.current?.focus();
    });

    window.jarvis.onError((errMsg) => {
      setBusy(false);
      setStreaming(false);
      setMessages((prev) => {
        // Replace streaming bubble if exists, else append
        const hasStreaming = prev.some((m) => m.streaming);
        const errorBubble = {
          id: Date.now(),
          role: 'jarvis',
          content: `⚠️ ${errMsg}`,
          streaming: false,
        };
        return hasStreaming
          ? prev.map((m) => m.streaming ? errorBubble : m)
          : [...prev, errorBubble];
      });
      window.jarvis.offStream();
    });

    window.jarvis.sendMessage(content);
  }, [input, busy, streaming]);

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  const isDisabled = busy || streaming;

  return (
    <div
      className="flex flex-col w-[380px] h-[600px] rounded-2xl overflow-hidden"
      style={{
        background: '#0A0A0F',
        boxShadow:
          '0 0 0 1px rgba(99,102,241,0.2), 0 24px 64px rgba(0,0,0,0.85), 0 0 48px rgba(99,102,241,0.12)',
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-3.5 shrink-0"
        style={{
          background: '#0D0D15',
          borderBottom: '1px solid rgba(99,102,241,0.15)',
          WebkitAppRegion: 'drag',
        }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #6366F1 0%, #818CF8 100%)' }}
          >
            J
          </div>
          <span className="text-white font-semibold tracking-[0.12em] text-sm">JARVIS</span>
        </div>

        <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' }}>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse-dot" />
            <span className="text-subtext text-[11px]">
              {streaming ? 'Antwortet…' : 'Active'}
            </span>
          </div>
          <button
            onClick={() => window.jarvis?.closeWindow()}
            className="w-5 h-5 rounded flex items-center justify-center text-subtext hover:text-white hover:bg-white/10 transition-colors"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M1 1l8 8M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Messages ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2">
        {messages.map((msg) => (
          <Message key={msg.id} msg={msg} />
        ))}
        {busy && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* ── Input ──────────────────────────────────────────────────── */}
      <div
        className="shrink-0 px-3 py-3"
        style={{ borderTop: '1px solid rgba(99,102,241,0.12)' }}
      >
        <div
          className="flex items-center gap-2 rounded-xl px-3 py-2"
          style={{
            background: '#13131A',
            border: '1px solid rgba(99,102,241,0.2)',
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={isDisabled ? 'JARVIS schreibt…' : 'Frag JARVIS etwas…'}
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
              background:
                input.trim() && !isDisabled
                  ? 'linear-gradient(135deg, #6366F1 0%, #818CF8 100%)'
                  : 'rgba(99,102,241,0.2)',
              WebkitAppRegion: 'no-drag',
            }}
          >
            <SendIcon />
          </button>
        </div>
        <p className="text-center text-subtext/40 text-[10px] mt-2">
          ⌘⇧J zum Öffnen/Schließen
        </p>
      </div>
    </div>
  );
}
