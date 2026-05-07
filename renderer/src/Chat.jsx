import React, { useState, useRef, useEffect, useCallback } from 'react';
import Voice from './Voice';

const WELCOME = [{
  id: 1, role: 'jarvis', streaming: false,
  content: 'Hallo! Ich bin JARVIS — dein persönlicher KI-Assistent.\nFrag mich nach Emails, Terminen, Dateien oder einfach was du brauchst. 🚀',
}];

// ── Sub-components ─────────────────────────────────────────────────────────

function Avatar() {
  return (
    <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white mr-2 mt-0.5 shrink-0"
         style={{ background:'linear-gradient(135deg,#6366F1 0%,#818CF8 100%)' }}>J</div>
  );
}

function Message({ msg }) {
  const isUser = msg.role === 'user';
  const isProactive = msg.proactive;
  return (
    <div className={`flex animate-msg-in mb-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && <Avatar />}
      <div className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap break-words ${
        isUser
          ? 'bg-white text-[#0A0A0F] rounded-br-sm font-medium'
          : isProactive
            ? 'bg-[#1A1A26] text-white border border-[rgba(16,185,129,0.35)] rounded-bl-sm'
            : 'bg-[#1A1A26] text-white border border-[rgba(99,102,241,0.25)] rounded-bl-sm'
      }`}>
        {isProactive && <span className="text-[10px] text-success/70 font-semibold uppercase tracking-wider block mb-1">Proaktiv</span>}
        {msg.content}
        {msg.streaming && <span className="inline-block w-[2px] h-[14px] bg-[#818CF8] ml-0.5 align-middle animate-blink" />}
      </div>
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center mb-3">
      <Avatar />
      <div className="bg-[#1A1A26] border border-[rgba(99,102,241,0.25)] rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
        <span className="w-1.5 h-1.5 rounded-full bg-subtext animate-typing-1 block"/>
        <span className="w-1.5 h-1.5 rounded-full bg-subtext animate-typing-2 block"/>
        <span className="w-1.5 h-1.5 rounded-full bg-subtext animate-typing-3 block"/>
      </div>
    </div>
  );
}

function ToolBadge({ status }) {
  if (!status) return null;
  return (
    <div className="flex items-center gap-2 mx-8 mb-3 px-3 py-1.5 rounded-lg animate-msg-in"
         style={{ background:'rgba(99,102,241,0.1)', border:'1px solid rgba(99,102,241,0.2)' }}>
      <div className="w-3 h-3 rounded-full border-2 border-[#6366F1] border-t-transparent animate-spin shrink-0"/>
      <span className="text-[#818CF8] text-xs">{status}</span>
    </div>
  );
}

function ConfirmDialog({ data, onConfirm, onCancel }) {
  return (
    <div className="mx-3 mb-2 px-4 py-3 rounded-xl animate-msg-in"
         style={{ background:'rgba(245,158,11,0.08)', border:'1px solid rgba(245,158,11,0.3)' }}>
      <p className="text-amber-400 text-[11px] font-semibold uppercase tracking-wider mb-1.5">⚠️ Bestätigung erforderlich</p>
      <p className="text-white text-sm leading-relaxed">{data.message}</p>
      {data.detail && (
        <code className="block mt-2 text-xs text-subtext/80 bg-black/30 rounded-lg px-3 py-2 font-mono break-all">
          {data.detail}
        </code>
      )}
      <div className="flex gap-2 mt-3">
        <button onClick={onConfirm}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors"
                style={{ background:'linear-gradient(135deg,#6366F1,#818CF8)' }}>
          ✓ Ja, ausführen
        </button>
        <button onClick={onCancel}
                className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white/60 bg-white/10 hover:bg-white/15 transition-colors">
          ✕ Abbrechen
        </button>
      </div>
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────

const IconSend = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
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

// ── Clock ──────────────────────────────────────────────────────────────────

function Clock() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' }));
  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' })), 10000);
    return () => clearInterval(t);
  }, []);
  return <span className="text-subtext/50 text-[11px] tabular-nums">{time}</span>;
}

// ── Main Chat ──────────────────────────────────────────────────────────────

export default function Chat({ ttsOn, onToggleTTS, onOpenSettings }) {
  const [messages,   setMessages]   = useState(WELCOME);
  const [input,      setInput]      = useState('');
  const [busy,       setBusy]       = useState(false);
  const [streaming,  setStreaming]  = useState(false);
  const [speaking,   setSpeaking]   = useState(false);
  const [toolStatus,  setToolStatus]  = useState('');
  const [confirmData, setConfirmData] = useState(null);

  const bottomRef     = useRef(null);
  const inputRef      = useRef(null);
  const streamTextRef = useRef('');
  const ttsOnRef      = useRef(ttsOn);
  const audioRef      = useRef(null);

  useEffect(() => { ttsOnRef.current = ttsOn; }, [ttsOn]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior:'smooth' }); }, [messages, busy, toolStatus]);
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Confirmation requests
  useEffect(() => {
    if (!window.jarvis) return;
    window.jarvis.onConfirm((data) => setConfirmData(data));
    return () => window.jarvis.offConfirm();
  }, []);

  // Proactive messages pushed from main process
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
      // Surface a cancellation message
      setMessages((p) => [...p, { id:Date.now(), role:'jarvis', content:'Abgebrochen.', streaming:false }]);
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
    setMessages((p) => [...p, { id:Date.now(), role:'user', content, streaming:false }]);

    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; setSpeaking(false); }

    if (!window.jarvis) {
      // Browser preview
      setTimeout(() => {
        setBusy(false);
        const id = Date.now()+1;
        setMessages((p) => [...p, { id, role:'jarvis', content:'', streaming:true }]);
        setStreaming(true);
        const words = ['Alles Phasen implementiert! 🎉 ', 'Calendar, Memory, Files, System-Tools, ', 'Settings — alles aktiv! ⚡'];
        let i = 0;
        const t = setInterval(() => {
          if (i >= words.length) { clearInterval(t); setMessages((p) => p.map((m) => m.id===id ? {...m,streaming:false} : m)); setStreaming(false); return; }
          setMessages((p) => p.map((m) => m.id===id ? {...m, content: m.content+words[i]} : m));
          i++;
        }, 280);
      }, 500);
      return;
    }

    window.jarvis.onToolStatus((s) => { setBusy(false); setToolStatus(s); });

    window.jarvis.onChunk((chunk) => {
      streamTextRef.current += chunk;
      setBusy(false); setToolStatus(''); setStreaming(true);
      setMessages((prev) => {
        const last = prev[prev.length-1];
        if (last?.streaming) return prev.map((m) => m.id===last.id ? {...m, content:m.content+chunk} : m);
        const id = Date.now();
        return [...prev, { id, role:'jarvis', content:chunk, streaming:true }];
      });
    });

    window.jarvis.onDone(({ fullText } = {}) => {
      setMessages((p) => p.map((m) => m.streaming ? {...m,streaming:false} : m));
      setStreaming(false); setBusy(false); setToolStatus('');
      window.jarvis.offStream();
      inputRef.current?.focus();
      playTTS(fullText || streamTextRef.current);
    });

    window.jarvis.onError((msg) => {
      setBusy(false); setStreaming(false); setToolStatus('');
      const err = { id:Date.now(), role:'jarvis', content:`⚠️ ${msg}`, streaming:false };
      setMessages((p) => p.some((m) => m.streaming) ? p.map((m) => m.streaming ? err : m) : [...p, err]);
      window.jarvis.offStream();
    });

    window.jarvis.sendMessage(content);
  }, [input, busy, streaming]); // eslint-disable-line

  const handleKey = (e) => { if (e.key==='Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } };
  const isDisabled = busy || streaming;
  const statusLabel = speaking ? 'Spricht…' : streaming ? 'Antwortet…' : toolStatus ? 'Arbeitet…' : 'Active';

  return (
    <div className="flex flex-col w-[380px] h-[600px] rounded-2xl overflow-hidden"
         style={{ background:'#0A0A0F', boxShadow:'0 0 0 1px rgba(99,102,241,0.2), 0 24px 64px rgba(0,0,0,0.85), 0 0 48px rgba(99,102,241,0.12)' }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3.5 shrink-0"
           style={{ background:'#0D0D15', borderBottom:'1px solid rgba(99,102,241,0.15)', WebkitAppRegion:'drag' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white"
               style={{ background:'linear-gradient(135deg,#6366F1 0%,#818CF8 100%)', boxShadow:'0 0 12px rgba(99,102,241,0.4)' }}>J</div>
          <span className="text-white font-semibold tracking-[0.12em] text-sm">JARVIS</span>
        </div>

        <div className="flex items-center gap-2" style={{ WebkitAppRegion:'no-drag' }}>
          <Clock />
          <div className="w-px h-3 bg-white/10 mx-0.5" />

          {/* TTS toggle */}
          <button onClick={() => { if(audioRef.current){audioRef.current.pause();audioRef.current=null;setSpeaking(false);} onToggleTTS(); }}
                  title={ttsOn ? 'Stimme an' : 'Stimme aus'}
                  className={`w-6 h-6 rounded flex items-center justify-center transition-colors hover:text-white ${ttsOn ? 'text-[#818CF8]' : 'text-subtext/40'}`}>
            <IconSpeaker on={ttsOn} />
          </button>

          {/* Status */}
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${speaking ? 'bg-[#818CF8]' : 'bg-success'} animate-pulse-dot`}/>
            <span className="text-subtext text-[11px] w-[58px]">{statusLabel}</span>
          </div>

          {/* Settings */}
          <button onClick={onOpenSettings}
                  className="w-6 h-6 rounded flex items-center justify-center text-subtext hover:text-white hover:bg-white/10 transition-colors">
            <IconGear />
          </button>

          {/* Close */}
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
        {messages.map((m) => <Message key={m.id} msg={m} />)}
        {toolStatus && <ToolBadge status={toolStatus} />}
        {busy && !toolStatus && <TypingDots />}
        <div ref={bottomRef} />
      </div>

      {/* ── Confirmation dialog ───────────────────────────────────── */}
      {confirmData && (
        <ConfirmDialog
          data={confirmData}
          onConfirm={() => handleConfirm(true)}
          onCancel={() => handleConfirm(false)}
        />
      )}

      {/* ── Input ──────────────────────────────────────────────────── */}
      <div className="shrink-0 px-3 py-3" style={{ borderTop:'1px solid rgba(99,102,241,0.12)' }}>
        <div className="flex items-center gap-2 rounded-xl px-3 py-2"
             style={{ background:'#13131A', border:'1px solid rgba(99,102,241,0.2)' }}>
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder={isDisabled ? 'JARVIS arbeitet…' : 'Frag JARVIS etwas…'}
            disabled={isDisabled}
            className="flex-1 bg-transparent text-white text-sm outline-none placeholder-subtext/50 disabled:opacity-60"
            style={{ WebkitAppRegion:'no-drag' }}
          />
          <Voice onTranscript={sendMessage} disabled={isDisabled} />
          <button onClick={() => sendMessage()} disabled={!input.trim() || isDisabled}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ background: input.trim()&&!isDisabled ? 'linear-gradient(135deg,#6366F1 0%,#818CF8 100%)' : 'rgba(99,102,241,0.2)', WebkitAppRegion:'no-drag' }}>
            <IconSend />
          </button>
        </div>
        <p className="text-center text-subtext/40 text-[10px] mt-2">⌘⇧J öffnen · Halten = Spracheingabe</p>
      </div>
    </div>
  );
}
