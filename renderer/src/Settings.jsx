import React, { useState, useEffect } from 'react';

function Section({ title, children }) {
  return (
    <div className="mb-5">
      <p className="text-[10px] font-semibold tracking-[0.15em] text-subtext/60 uppercase mb-2 px-1">{title}</p>
      <div className="rounded-xl overflow-hidden" style={{ background:'#13131A', border:'1px solid rgba(99,102,241,0.15)' }}>
        {children}
      </div>
    </div>
  );
}

function Row({ label, sub, right, onClick, danger }) {
  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-between px-4 py-3 border-b last:border-0 border-white/5 ${onClick ? 'cursor-pointer hover:bg-white/5 transition-colors' : ''}`}
    >
      <div>
        <p className={`text-sm ${danger ? 'text-red-400' : 'text-white'}`}>{label}</p>
        {sub && <p className="text-[11px] text-subtext mt-0.5">{sub}</p>}
      </div>
      {right}
    </div>
  );
}

function Toggle({ value, onChange }) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onChange(!value); }}
      className={`relative w-9 h-5 rounded-full transition-colors duration-200 shrink-0 ${value ? 'bg-accent' : 'bg-white/20'}`}
    >
      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${value ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
    </button>
  );
}

function StatusDot({ ok }) {
  return <span className={`w-2 h-2 rounded-full shrink-0 ${ok ? 'bg-success' : 'bg-white/25'}`} />;
}

function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-subtext/50">
      <path d="M9 18l6-6-6-6"/>
    </svg>
  );
}

export default function Settings({ onClose, ttsOn, onToggleTTS }) {
  const [config,    setConfig]    = useState(null);
  const [google,    setGoogle]    = useState({ configured:false, authenticated:false });
  const [memStats,  setMemStats]  = useState({ factCount:0, historyCount:0 });
  const [connecting, setConnecting] = useState(false);
  const [clearing,   setClearing]   = useState('');

  useEffect(() => {
    if (!window.jarvis) return;
    window.jarvis.configStatus().then(setConfig).catch(()=>{});
    window.jarvis.googleStatus().then(setGoogle).catch(()=>{});
    window.jarvis.memoryStats().then(setMemStats).catch(()=>{});
  }, []);

  async function connectGoogle() {
    setConnecting(true);
    try {
      const r = await window.jarvis.googleConnect();
      if (r.success) setGoogle({ configured:true, authenticated:true });
    } finally { setConnecting(false); }
  }

  async function revokeGoogle() {
    await window.jarvis.googleRevoke();
    setGoogle((g) => ({ ...g, authenticated:false }));
  }

  async function clearMemory() {
    setClearing('memory');
    await window.jarvis.memoryClear();
    setMemStats((s) => ({ ...s, factCount: 0 }));
    setClearing('');
  }

  async function clearHistory() {
    setClearing('history');
    await window.jarvis.historyClear();
    setMemStats((s) => ({ ...s, historyCount: 0 }));
    setClearing('');
  }

  return (
    <div
      className="absolute inset-0 flex flex-col rounded-2xl overflow-hidden z-20"
      style={{ background:'#0A0A0F', animation:'slide-in-right 0.22s ease-out forwards' }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5 shrink-0"
           style={{ background:'#0D0D15', borderBottom:'1px solid rgba(99,102,241,0.15)', WebkitAppRegion:'drag' }}>
        <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-subtext hover:text-white hover:bg-white/10 transition-colors" style={{ WebkitAppRegion:'no-drag' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </button>
        <span className="text-white font-semibold text-sm tracking-wide">Einstellungen</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">

        {/* API Status */}
        <Section title="API-Verbindungen">
          <Row label="Claude (Anthropic)" sub="KI-Brain" right={<StatusDot ok={config?.anthropic} />} />
          <Row label="OpenAI Whisper" sub="Spracherkennung" right={<StatusDot ok={config?.openai} />} />
          <Row label="ElevenLabs TTS" sub="Sprachausgabe" right={<StatusDot ok={config?.elevenlabs} />} />
        </Section>

        {/* Google */}
        <Section title="Google (Gmail + Calendar)">
          {!google.configured ? (
            <Row label="Nicht konfiguriert" sub="GOOGLE_CLIENT_ID fehlt in .env" right={null} />
          ) : google.authenticated ? (
            <Row label="Verbunden ✓" sub="Gmail & Calendar aktiv"
              right={<button onClick={revokeGoogle} className="text-[11px] text-red-400/80 hover:text-red-400 transition-colors px-2 py-1 rounded hover:bg-red-500/10">Trennen</button>}
            />
          ) : (
            <Row label="Nicht angemeldet" sub="Einmalig mit Google autorisieren"
              right={
                <button onClick={connectGoogle} disabled={connecting}
                  className="text-[11px] font-medium text-white px-3 py-1.5 rounded-lg disabled:opacity-50 transition-opacity"
                  style={{ background:'linear-gradient(135deg,#6366F1,#818CF8)' }}>
                  {connecting ? 'Öffnet…' : 'Verbinden'}
                </button>
              }
            />
          )}
        </Section>

        {/* Voice */}
        <Section title="Stimme">
          <Row label="Text-to-Speech" sub="JARVIS liest Antworten vor" right={<Toggle value={ttsOn} onChange={onToggleTTS} />} />
        </Section>

        {/* Memory */}
        <Section title="Gedächtnis">
          <Row label="Gespeicherte Fakten" right={
            <span className="text-subtext text-sm">{memStats.factCount}</span>
          }/>
          <Row label="Conversation-Verlauf" right={
            <span className="text-subtext text-sm">{memStats.historyCount} Nachrichten</span>
          }/>
        </Section>

        {/* Danger zone */}
        <Section title="Zurücksetzen">
          <Row label="Verlauf löschen" sub="Conversation-Kontext zurücksetzen"
            danger onClick={clearHistory}
            right={clearing==='history'
              ? <div className="w-4 h-4 border-2 border-red-400/40 border-t-red-400 rounded-full animate-spin"/>
              : <Chevron />}
          />
          <Row label="Gedächtnis löschen" sub="Alle gespeicherten Fakten entfernen"
            danger onClick={clearMemory}
            right={clearing==='memory'
              ? <div className="w-4 h-4 border-2 border-red-400/40 border-t-red-400 rounded-full animate-spin"/>
              : <Chevron />}
          />
        </Section>

        {/* About */}
        <div className="text-center pt-1 pb-2">
          <p className="text-subtext/40 text-[11px]">JARVIS v0.2 · claude-sonnet-4-6</p>
          <p className="text-subtext/25 text-[10px] mt-0.5">Electron · React · Tailwind</p>
        </div>
      </div>
    </div>
  );
}
