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
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${danger ? 'text-red-400' : 'text-white'}`}>{label}</p>
        {sub && <p className="text-[11px] text-subtext mt-0.5">{sub}</p>}
      </div>
      {right && <div className="ml-3 shrink-0">{right}</div>}
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
  return <span className={`w-2 h-2 rounded-full shrink-0 ${ok ? 'bg-success' : 'bg-red-400/70'}`} />;
}

function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-subtext/50">
      <path d="M9 18l6-6-6-6"/>
    </svg>
  );
}

function ApiKeyRow({ label, sub, envKey, onSaved }) {
  const [editing, setEditing]   = useState(false);
  const [value,   setValue]     = useState('');
  const [masked,  setMasked]    = useState('');
  const [saving,  setSaving]    = useState(false);
  const [saved,   setSaved]     = useState(false);

  useEffect(() => {
    if (!window.jarvis?.configGet) return;
    window.jarvis.configGet(envKey).then(v => {
      if (v) setMasked(v.slice(0, 8) + '••••••••' + v.slice(-4));
      else   setMasked('');
    });
  }, [envKey]);

  async function save() {
    if (!value.trim()) return;
    setSaving(true);
    await window.jarvis.configSet(envKey, value.trim());
    const v = value.trim();
    setMasked(v.slice(0, 8) + '••••••••' + v.slice(-4));
    setValue('');
    setEditing(false);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onSaved?.();
  }

  async function clear() {
    await window.jarvis.configSet(envKey, '');
    setMasked('');
    setValue('');
    setEditing(false);
    onSaved?.();
  }

  return (
    <div className="px-4 py-3 border-b last:border-0 border-white/5">
      <div className="flex items-center justify-between mb-1">
        <div>
          <p className="text-sm text-white">{label}</p>
          {sub && <p className="text-[11px] text-subtext mt-0.5">{sub}</p>}
        </div>
        <div className="flex items-center gap-2 ml-3">
          {saved && <span className="text-[11px] text-success">Gespeichert ✓</span>}
          <StatusDot ok={!!masked} />
        </div>
      </div>

      {editing ? (
        <div className="mt-2 flex gap-2">
          <input
            autoFocus
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
            placeholder={`${envKey}=sk-...`}
            className="flex-1 min-w-0 text-[12px] rounded-lg px-3 py-1.5 outline-none font-mono"
            style={{ background:'#0A0A14', border:'1px solid rgba(99,102,241,0.35)', color:'#e2e8f0' }}
          />
          <button
            onClick={save}
            disabled={saving || !value.trim()}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg disabled:opacity-40 transition-opacity shrink-0"
            style={{ background:'linear-gradient(135deg,#6366F1,#818CF8)', color:'#fff' }}
          >
            {saving ? '…' : 'OK'}
          </button>
          <button
            onClick={() => { setEditing(false); setValue(''); }}
            className="text-[11px] text-subtext px-2 py-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0"
          >✕</button>
        </div>
      ) : (
        <div className="mt-1.5 flex items-center gap-2">
          <span className="text-[11px] text-subtext/70 font-mono flex-1 truncate">
            {masked || 'nicht gesetzt'}
          </span>
          <button
            onClick={() => setEditing(true)}
            className="text-[11px] text-accent/80 hover:text-accent transition-colors px-2 py-0.5 rounded hover:bg-accent/10 shrink-0"
          >
            {masked ? 'Ändern' : 'Eintragen'}
          </button>
          {masked && (
            <button
              onClick={clear}
              className="text-[11px] text-red-400/60 hover:text-red-400 transition-colors px-1.5 py-0.5 rounded hover:bg-red-500/10 shrink-0"
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function Settings({ onClose, ttsOn, onToggleTTS, wakeWordOn, onToggleWakeWord }) {
  const [config,    setConfig]    = useState(null);
  const [google,    setGoogle]    = useState({ configured:false, authenticated:false });
  const [memStats,  setMemStats]  = useState({ factCount:0, historyCount:0 });
  const [connecting, setConnecting] = useState(false);
  const [clearing,   setClearing]   = useState('');

  function refreshStatus() {
    if (!window.jarvis) return;
    window.jarvis.configStatus().then(setConfig).catch(()=>{});
    window.jarvis.googleStatus().then(setGoogle).catch(()=>{});
  }

  useEffect(() => {
    refreshStatus();
    window.jarvis?.memoryStats().then(setMemStats).catch(()=>{});
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

        {/* API Keys */}
        <Section title="API-Keys">
          <ApiKeyRow
            label="Anthropic (Claude)"
            sub="KI-Brain — claude.ai/settings → API Keys"
            envKey="ANTHROPIC_API_KEY"
            onSaved={refreshStatus}
          />
          <ApiKeyRow
            label="OpenAI Whisper"
            sub="Spracherkennung — platform.openai.com/api-keys"
            envKey="OPENAI_API_KEY"
            onSaved={refreshStatus}
          />
          <ApiKeyRow
            label="ElevenLabs"
            sub="TTS — elevenlabs.io/app/settings/api-keys"
            envKey="ELEVENLABS_API_KEY"
            onSaved={refreshStatus}
          />
          <ApiKeyRow
            label="ElevenLabs Voice ID"
            sub="Voice ID aus dem ElevenLabs Dashboard"
            envKey="ELEVENLABS_VOICE_ID"
            onSaved={refreshStatus}
          />
          <ApiKeyRow
            label="Picovoice (Wake Word)"
            sub="console.picovoice.ai → kostenlosen AccessKey holen"
            envKey="PICOVOICE_ACCESS_KEY"
            onSaved={refreshStatus}
          />
        </Section>

        {/* Status */}
        <Section title="Verbindungsstatus">
          <Row label="Claude (Anthropic)" sub="KI-Brain" right={<StatusDot ok={config?.anthropic} />} />
          <Row label="OpenAI Whisper" sub="Spracherkennung" right={<StatusDot ok={config?.openai} />} />
          <Row label="ElevenLabs TTS" sub="Sprachausgabe" right={<StatusDot ok={config?.elevenlabs} />} />
        </Section>

        {/* Google */}
        <Section title="Google (Gmail + Calendar)">
          {!google.configured ? (
            <Row label="Nicht konfiguriert" sub="Google Client ID nicht gesetzt" right={null} />
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
        <Section title="Stimme &amp; Wake Word">
          <Row label="Text-to-Speech" sub="JARVIS liest Antworten vor" right={<Toggle value={ttsOn} onChange={onToggleTTS} />} />
          <Row
            label="Wake Word — &quot;Hey JARVIS&quot;"
            sub={wakeWordOn ? 'Hört auf dich · Picovoice AccessKey nötig' : 'Deaktiviert — AccessKey in API-Keys eintragen'}
            right={<Toggle value={!!wakeWordOn} onChange={onToggleWakeWord} />}
          />
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

        {/* Notion & Obsidian */}
        <Section title="Notion &amp; Obsidian">
          <ApiKeyRow
            label="Notion API Key"
            sub="notion.so/my-integrations → New integration"
            envKey="NOTION_API_KEY"
            onSaved={refreshStatus}
          />
          <ApiKeyRow
            label="Notion Database ID"
            sub="Datenbank-URL: notion.so/.../<ID>?v=..."
            envKey="NOTION_DATABASE_ID"
            onSaved={refreshStatus}
          />
          <ApiKeyRow
            label="Obsidian Vault Pfad"
            sub="Absoluter Pfad zu deinem Vault, z.B. /Users/paul/Notes"
            envKey="OBSIDIAN_VAULT_PATH"
            onSaved={refreshStatus}
          />
        </Section>

        {/* Integration Status */}
        <Section title="Integrations-Status">
          <Row label="Notion" sub="Seiten lesen &amp; erstellen" right={<StatusDot ok={config?.notion} />} />
          <Row label="Obsidian" sub="Vault lesen &amp; schreiben" right={<StatusDot ok={config?.obsidian} />} />
          <Row label="iMessage" sub="Nachrichten via AppleScript" right={<StatusDot ok={true} />} />
          <Row label="Apple Notes" sub="Notizen lesen &amp; erstellen" right={<StatusDot ok={true} />} />
          <Row label="Reminders" sub="Erinnerungen verwalten" right={<StatusDot ok={true} />} />
          <Row label="Contacts" sub="Mac-Kontakte suchen" right={<StatusDot ok={true} />} />
          <Row label="Safari" sub="Tabs &amp; Verlauf" right={<StatusDot ok={true} />} />
          <Row label="Photos" sub="Bibliothek durchsuchen" right={<StatusDot ok={true} />} />
        </Section>

        {/* Free APIs */}
        <Section title="Web &amp; Research (kostenlos)">
          <Row label="Wetter" sub="Open-Meteo — kein API Key nötig" right={<StatusDot ok={true} />} />
          <Row label="Web-Suche" sub="DuckDuckGo Instant Answers" right={<StatusDot ok={true} />} />
          <Row label="News" sub="RSS Feeds (BBC, Tagesschau, TechCrunch)" right={<StatusDot ok={true} />} />
          <Row label="Aktien" sub="Yahoo Finance" right={<StatusDot ok={true} />} />
          <Row label="Krypto" sub="CoinGecko" right={<StatusDot ok={true} />} />
          <Row label="Wikipedia" sub="DE &amp; EN" right={<StatusDot ok={true} />} />
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
