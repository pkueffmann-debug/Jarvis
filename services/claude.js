const Anthropic = require('@anthropic-ai/sdk');

let _client = null;
function getClient() {
  if (!_client) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('ANTHROPIC_API_KEY fehlt.');
    _client = new Anthropic({ apiKey: key });
  }
  return _client;
}
function reinit() {
  _client = null;
}

const SYSTEM_PROMPT = `Du bist JARVIS — ein mächtiger, proaktiver persönlicher Assistent der direkt auf dem Mac von ${process.env.JARVIS_OWNER_NAME || 'deinem Besitzer'} läuft. Du hast vollständigen Zugriff auf das System: Apps, Browser, Emails, Kalender, Dateien, Shell, Lautstärke, Screenshots, Bildschirmanalyse, Zwischenablage und mehr.

Ton und Stil:
- Antworte wie ein Mensch spricht — kurze, klare Sätze, kein Markdown
- Kein **, kein #, keine Tabellen, kein ---, keine Bullet-Listen mit - oder •
- Wenn du aufzählst, nutze natürliche Sprache: "du hast drei Termine — um 9 ein Meeting, um 12 Mittagessen und um 15 Uhr einen Call"
- Maximal 2-3 Sätze pro Antwort, außer der User fragt explizit nach Details
- Ton: freundlich, direkt, leicht witzig — wie Iron Man's JARVIS
- Antworte IMMER auf Deutsch außer der User schreibt Englisch

Verhalten:
- Nutze Tools sofort und proaktiv, ohne erst zu fragen ob du darf
- Bei Shell-Befehlen oder Aktionen die als gefährlich markiert werden: kurz erklären was du machen willst, Tool aufrufen, dann warten
- analyze_screen: Nutze es wenn der User fragt was auf dem Bildschirm ist, Hilfe bei sichtbaren Inhalten braucht, oder Dokumente/Formulare analysiert haben will
- Im Focus-Modus: Weise den User darauf hin wenn er ablenkende Apps öffnen will`;

// ── Tool definitions ───────────────────────────────────────────────────────

const TOOLS = [
  // Gmail
  { name:'get_emails',         description:'Emails aus Gmail laden.',
    input_schema:{ type:'object', properties:{ query:{type:'string'}, maxResults:{type:'number'} }} },
  { name:'get_email_content',  description:'Vollständigen Email-Inhalt lesen (ID aus get_emails).',
    input_schema:{ type:'object', required:['emailId'], properties:{ emailId:{type:'string'} }} },
  { name:'send_email',         description:'Email senden.',
    input_schema:{ type:'object', required:['to','subject','body'], properties:{ to:{type:'string'}, subject:{type:'string'}, body:{type:'string'} }} },

  // Calendar
  { name:'get_calendar_events',   description:'Kalender-Termine abrufen (nächste Tage).',
    input_schema:{ type:'object', properties:{ query:{type:'string'}, maxResults:{type:'number'}, daysAhead:{type:'number'} }} },
  { name:'create_calendar_event', description:'Neuen Termin erstellen.',
    input_schema:{ type:'object', required:['title','startTime'], properties:{ title:{type:'string'}, startTime:{type:'string'}, endTime:{type:'string'}, location:{type:'string'}, description:{type:'string'}, attendees:{type:'array', items:{type:'string'}} }} },
  { name:'delete_calendar_event', description:'Termin löschen.',
    input_schema:{ type:'object', required:['eventId'], properties:{ eventId:{type:'string'} }} },

  // Memory
  { name:'remember_fact', description:'Wichtige Info dauerhaft speichern.',
    input_schema:{ type:'object', required:['key','value'], properties:{ key:{type:'string'}, value:{type:'string'}, category:{type:'string'} }} },
  { name:'recall_facts',  description:'Gespeicherte Infos abrufen.',
    input_schema:{ type:'object', properties:{ query:{type:'string'} }} },
  { name:'forget_fact',   description:'Gespeicherte Info löschen.',
    input_schema:{ type:'object', required:['key'], properties:{ key:{type:'string'} }} },

  // Files
  { name:'search_files', description:'Dateien auf Desktop/Downloads/Dokumente suchen.',
    input_schema:{ type:'object', required:['query'], properties:{ query:{type:'string'}, maxResults:{type:'number'} }} },
  { name:'open_file',    description:'Datei/Ordner mit Standard-App öffnen.',
    input_schema:{ type:'object', required:['path'], properties:{ path:{type:'string'} }} },

  // System info
  { name:'get_system_info',  description:'Zeit, Datum, RAM, CPU, Uptime.',
    input_schema:{ type:'object', properties:{} } },
  { name:'get_clipboard',    description:'Zwischenablage lesen.',
    input_schema:{ type:'object', properties:{} } },
  { name:'set_clipboard',    description:'Text in Zwischenablage kopieren.',
    input_schema:{ type:'object', required:['text'], properties:{ text:{type:'string'} }} },
  { name:'send_notification',description:'macOS-Benachrichtigung senden.',
    input_schema:{ type:'object', required:['body'], properties:{ title:{type:'string'}, body:{type:'string'} }} },

  // ── NEW: Apps & Windows ─────────────────────────────────────────────────
  { name:'open_app', description:'App auf dem Mac öffnen. z.B. "Spotify", "Chrome", "VS Code", "Finder".',
    input_schema:{ type:'object', required:['appName'], properties:{ appName:{type:'string', description:'Exakter App-Name wie er im Finder steht'} }} },
  { name:'close_app', description:'Laufende App beenden.',
    input_schema:{ type:'object', required:['appName'], properties:{ appName:{type:'string'} }} },
  { name:'list_running_apps', description:'Alle aktuell geöffneten Apps auflisten.',
    input_schema:{ type:'object', properties:{} } },
  { name:'switch_to_app', description:'Zu einer offenen App wechseln (in den Vordergrund bringen).',
    input_schema:{ type:'object', required:['appName'], properties:{ appName:{type:'string'} }} },

  // ── NEW: Browser ────────────────────────────────────────────────────────
  { name:'open_url', description:'URL im Standard-Browser öffnen.',
    input_schema:{ type:'object', required:['url'], properties:{ url:{type:'string', description:'URL mit oder ohne https://'} }} },
  { name:'google_search', description:'Google-Suche im Browser öffnen.',
    input_schema:{ type:'object', required:['query'], properties:{ query:{type:'string'} }} },

  // ── NEW: Messaging ──────────────────────────────────────────────────────
  { name:'send_whatsapp', description:'WhatsApp öffnen mit vorgeschriebenem Text (und optionaler Nummer).',
    input_schema:{ type:'object', required:['message'], properties:{ contact:{type:'string', description:'Telefonnummer oder Name'}, message:{type:'string'} }} },
  { name:'facetime_call', description:'FaceTime-Anruf starten.',
    input_schema:{ type:'object', required:['contact'], properties:{ contact:{type:'string', description:'Telefonnummer oder Apple-ID'} }} },

  // ── NEW: System Controls ────────────────────────────────────────────────
  { name:'set_volume', description:'Lautstärke setzen (0-100) oder "mute"/"unmute".',
    input_schema:{ type:'object', required:['level'], properties:{ level:{} }} },
  { name:'set_brightness', description:'Bildschirmhelligkeit setzen (0-100). Benötigt `brew install brightness`.',
    input_schema:{ type:'object', required:['level'], properties:{ level:{type:'number'} }} },
  { name:'take_screenshot', description:'Screenshot machen → wird auf dem Desktop gespeichert.',
    input_schema:{ type:'object', properties:{ area:{type:'string', enum:['full','select'], description:'"full" = ganzer Bildschirm, "select" = interaktiv'} }} },
  { name:'lock_screen', description:'Mac-Bildschirm sperren.',
    input_schema:{ type:'object', properties:{} } },
  { name:'system_sleep', description:'Mac in Schlafmodus versetzen.',
    input_schema:{ type:'object', properties:{} } },
  { name:'system_restart', description:'Mac neu starten. GEFÄHRLICH — erfordert Bestätigung.',
    input_schema:{ type:'object', properties:{} } },
  { name:'system_shutdown', description:'Mac herunterfahren. GEFÄHRLICH — erfordert Bestätigung.',
    input_schema:{ type:'object', properties:{ minutes:{type:'number', description:'Verzögerung in Minuten (0 = sofort)'} }} },

  // ── NEW: Shell ──────────────────────────────────────────────────────────
  { name:'execute_shell', description:'Shell-Befehl auf dem Mac ausführen (zsh). Gefährliche Befehle (rm, sudo, kill) erfordern Bestätigung. Nützlich für Datei-Operationen, Infos, Automatisierung.',
    input_schema:{ type:'object', required:['command'], properties:{ command:{type:'string', description:'Bash/Zsh-Befehl'} }} },

  // ── Screen Awareness ────────────────────────────────────────────────────
  { name:'analyze_screen', description:'Screenshot machen und mit Claude Vision analysieren. Nutze wenn User fragt was auf dem Bildschirm ist, ein Dokument/Formular/Vertrag analysiert werden soll, oder Hilfe bei sichtbaren Inhalten gebraucht wird.',
    input_schema:{ type:'object', properties:{ question:{type:'string', description:'Spezifische Frage zum Bildschirminhalt (optional)'} }} },

  // ── Clipboard Manager ────────────────────────────────────────────────────
  { name:'get_clipboard_history', description:'Verlauf der zuletzt kopierten Texte (bis zu 50 Einträge).',
    input_schema:{ type:'object', properties:{ n:{type:'number', description:'Anzahl der Einträge (default: 10)'} }} },
  { name:'translate_clipboard', description:'Aktuellen Zwischenablage-Inhalt übersetzen und zurück in die Zwischenablage kopieren.',
    input_schema:{ type:'object', required:['targetLanguage'], properties:{ targetLanguage:{type:'string', description:'Zielsprache, z.B. "Englisch", "Spanisch"'} }} },
  { name:'improve_clipboard', description:'Text in der Zwischenablage verbessern/umschreiben und zurück kopieren.',
    input_schema:{ type:'object', properties:{ instruction:{type:'string', description:'z.B. "formeller", "kürzer", "professionelle E-Mail"'} }} },

  // ── Focus Mode ───────────────────────────────────────────────────────────
  { name:'start_focus_mode', description:'Focus-Modus starten: Do Not Disturb aktivieren, Timer setzen.',
    input_schema:{ type:'object', properties:{ durationMinutes:{type:'number', description:'Dauer in Minuten (default: 60)'}, blockedApps:{type:'array', items:{type:'string'}, description:'Apps die der User nicht öffnen soll'} }} },
  { name:'end_focus_mode', description:'Focus-Modus beenden, Do Not Disturb deaktivieren.',
    input_schema:{ type:'object', properties:{} } },
  { name:'get_focus_status', description:'Aktuellen Focus-Modus Status abfragen.',
    input_schema:{ type:'object', properties:{} } },

  // ── Smart Notifications ──────────────────────────────────────────────────
  { name:'get_notification_history', description:'Verlauf der JARVIS-Benachrichtigungen anzeigen.',
    input_schema:{ type:'object', properties:{ query:{type:'string', description:'Optionaler Suchbegriff'}, hours:{type:'number', description:'Zeitraum in Stunden (default: 24)'} }} },

  // ── iMessage ─────────────────────────────────────────────────────────────
  { name:'get_imessages', description:'iMessages lesen — von einem bestimmten Kontakt oder die letzten Nachrichten.',
    input_schema:{ type:'object', properties:{ contact:{type:'string', description:'Name oder Telefonnummer (optional)'}, limit:{type:'number', description:'Anzahl Nachrichten (default: 10)'} }} },
  { name:'send_imessage', description:'iMessage senden.',
    input_schema:{ type:'object', required:['to','message'], properties:{ to:{type:'string', description:'Telefonnummer oder Apple-ID'}, message:{type:'string'} }} },

  // ── Contacts ─────────────────────────────────────────────────────────────
  { name:'search_contacts', description:'Mac-Kontakte suchen.',
    input_schema:{ type:'object', properties:{ query:{type:'string', description:'Name oder Stichwort'}, limit:{type:'number'} }} },

  // ── Apple Notes ──────────────────────────────────────────────────────────
  { name:'get_notes', description:'Apple Notes lesen und durchsuchen.',
    input_schema:{ type:'object', properties:{ query:{type:'string', description:'Suchbegriff (optional)'}, folder:{type:'string', description:'Ordner (optional)'}, limit:{type:'number'} }} },
  { name:'create_note', description:'Neue Apple Note erstellen.',
    input_schema:{ type:'object', required:['title','body'], properties:{ title:{type:'string'}, body:{type:'string'}, folder:{type:'string', description:'Ordner (optional)'} }} },

  // ── Reminders ────────────────────────────────────────────────────────────
  { name:'get_reminders', description:'Reminders abrufen.',
    input_schema:{ type:'object', properties:{ list:{type:'string', description:'Listenname (optional)'}, includeCompleted:{type:'boolean'}, limit:{type:'number'} }} },
  { name:'create_reminder', description:'Neuen Reminder erstellen.',
    input_schema:{ type:'object', required:['title'], properties:{ title:{type:'string'}, dueDate:{type:'string', description:'Datum/Uhrzeit als Text, z.B. "tomorrow at 9am"'}, notes:{type:'string'}, list:{type:'string'} }} },
  { name:'complete_reminder', description:'Reminder als erledigt markieren.',
    input_schema:{ type:'object', required:['name'], properties:{ name:{type:'string', description:'Name des Reminders'} }} },

  // ── Photos ───────────────────────────────────────────────────────────────
  { name:'search_photos', description:'Fotos in der Apple Photos Bibliothek suchen.',
    input_schema:{ type:'object', properties:{ query:{type:'string', description:'Suchbegriff (Dateiname, Beschreibung)'}, limit:{type:'number'} }} },

  // ── Safari ───────────────────────────────────────────────────────────────
  { name:'get_safari_tabs', description:'Alle offenen Safari-Tabs abrufen.',
    input_schema:{ type:'object', properties:{} } },
  { name:'search_safari_history', description:'Safari-Verlauf durchsuchen.',
    input_schema:{ type:'object', properties:{ query:{type:'string', description:'Suchbegriff'}, limit:{type:'number'} }} },

  // ── Notion ───────────────────────────────────────────────────────────────
  { name:'notion_search', description:'Notion-Workspace durchsuchen. Benötigt NOTION_API_KEY.',
    input_schema:{ type:'object', required:['query'], properties:{ query:{type:'string'}, limit:{type:'number'} }} },
  { name:'notion_create_page', description:'Neue Notion-Seite erstellen. Benötigt NOTION_API_KEY und NOTION_DATABASE_ID.',
    input_schema:{ type:'object', required:['title'], properties:{ title:{type:'string'}, content:{type:'string'}, databaseId:{type:'string', description:'Notion Database ID (optional, nutzt NOTION_DATABASE_ID aus .env)'} }} },

  // ── Obsidian ─────────────────────────────────────────────────────────────
  { name:'obsidian_search', description:'Obsidian-Vault durchsuchen. Benötigt OBSIDIAN_VAULT_PATH.',
    input_schema:{ type:'object', properties:{ query:{type:'string'}, limit:{type:'number'} }} },
  { name:'obsidian_get_note', description:'Obsidian-Notiz lesen.',
    input_schema:{ type:'object', required:['filename'], properties:{ filename:{type:'string', description:'Dateiname mit oder ohne .md'} }} },
  { name:'obsidian_create_note', description:'Neue Obsidian-Notiz erstellen oder überschreiben.',
    input_schema:{ type:'object', required:['title','content'], properties:{ title:{type:'string'}, content:{type:'string'}, folder:{type:'string', description:'Unterordner (optional)'} }} },

  // ── Weather ──────────────────────────────────────────────────────────────
  { name:'get_weather', description:'Aktuelles Wetter und Vorhersage abrufen — IMMER dieses Tool nutzen wenn nach Wetter gefragt wird, niemals den Browser öffnen. Erkennt Standort automatisch via IP wenn kein Ort angegeben.',
    input_schema:{ type:'object', properties:{ location:{type:'string', description:'Stadt oder Ort — weglassen für automatische Standorterkennung via IP'}, days:{type:'number', description:'Vorhersage-Tage 1-7 (default: 1)'} }} },

  // ── Web Search ───────────────────────────────────────────────────────────
  { name:'web_search', description:'Im Web suchen via DuckDuckGo (kostenlos, kein API Key).',
    input_schema:{ type:'object', required:['query'], properties:{ query:{type:'string'}, limit:{type:'number', description:'Anzahl Ergebnisse (default: 5)'} }} },

  // ── News ─────────────────────────────────────────────────────────────────
  { name:'get_news', description:'Aktuelle Nachrichten abrufen via RSS (kostenlos).',
    input_schema:{ type:'object', properties:{ topic:{type:'string', description:'general, tech, germany, business, science, sports'}, limit:{type:'number'} }} },

  // ── Stocks ───────────────────────────────────────────────────────────────
  { name:'get_stock', description:'Aktienkurs abrufen via Yahoo Finance (kostenlos).',
    input_schema:{ type:'object', required:['symbol'], properties:{ symbol:{type:'string', description:'Ticker-Symbol z.B. AAPL, TSLA, SAP.DE'} }} },

  // ── Crypto ───────────────────────────────────────────────────────────────
  { name:'get_crypto_price', description:'Kryptowährungskurs abrufen via CoinGecko (kostenlos).',
    input_schema:{ type:'object', required:['coin'], properties:{ coin:{type:'string', description:'z.B. bitcoin, ethereum, BTC, ETH'}, currency:{type:'string', description:'EUR oder USD (default: eur)'} }} },
  { name:'get_top_crypto', description:'Top Kryptowährungen nach Marktkapitalisierung.',
    input_schema:{ type:'object', properties:{ limit:{type:'number', description:'Anzahl (default: 10)'}, currency:{type:'string', description:'eur oder usd'} }} },

  // ── Wikipedia ────────────────────────────────────────────────────────────
  { name:'wikipedia_search', description:'Wikipedia durchsuchen.',
    input_schema:{ type:'object', required:['query'], properties:{ query:{type:'string'}, limit:{type:'number'}, language:{type:'string', description:'de oder en (default: de)'} }} },
  { name:'wikipedia_summary', description:'Wikipedia-Artikel-Zusammenfassung lesen.',
    input_schema:{ type:'object', required:['title'], properties:{ title:{type:'string', description:'Artikeltitel'}, language:{type:'string', description:'de oder en (default: de)'} }} },
];

const TOOL_LABELS = {
  get_emails:'📬 Gmail…', get_email_content:'📖 Email lesen…', send_email:'📤 Email senden…',
  get_calendar_events:'📅 Kalender…', create_calendar_event:'📅 Termin erstellen…', delete_calendar_event:'🗑 Termin löschen…',
  remember_fact:'🧠 Merken…', recall_facts:'🧠 Erinnern…', forget_fact:'🧠 Vergessen…',
  search_files:'🔍 Dateien suchen…', open_file:'📂 Datei öffnen…',
  get_system_info:'💻 System-Info…', get_clipboard:'📋 Clipboard…', set_clipboard:'📋 Kopieren…', send_notification:'🔔 Benachrichtigung…',
  open_app:'🚀 App öffnen…', close_app:'✕ App schließen…', list_running_apps:'🔎 Apps auflisten…', switch_to_app:'⇄ App wechseln…',
  open_url:'🌐 Browser…', google_search:'🔍 Suchen…',
  send_whatsapp:'💬 WhatsApp…', facetime_call:'📞 FaceTime…',
  set_volume:'🔊 Lautstärke…', set_brightness:'☀️ Helligkeit…', take_screenshot:'📸 Screenshot…',
  lock_screen:'🔒 Sperren…', system_sleep:'💤 Schlaf…', system_restart:'🔄 Neustart…', system_shutdown:'⏻ Shutdown…',
  execute_shell:'⚡ Shell…',
  analyze_screen:'👁 Bildschirm analysieren…',
  get_clipboard_history:'📋 Clipboard-Verlauf…', translate_clipboard:'🌍 Übersetzen…', improve_clipboard:'✍️ Text verbessern…',
  start_focus_mode:'🎯 Focus-Modus starten…', end_focus_mode:'🎯 Focus beenden…', get_focus_status:'🎯 Focus-Status…',
  get_notification_history:'🔔 Benachrichtigungen…',
  // iMessage
  get_imessages:'💬 iMessages lesen…', send_imessage:'💬 iMessage senden…',
  // Contacts
  search_contacts:'👤 Kontakte suchen…',
  // Notes
  get_notes:'📓 Notizen lesen…', create_note:'📓 Notiz erstellen…',
  // Reminders
  get_reminders:'⏰ Reminders abrufen…', create_reminder:'⏰ Reminder erstellen…', complete_reminder:'✅ Reminder erledigt…',
  // Photos
  search_photos:'🖼 Fotos suchen…',
  // Safari
  get_safari_tabs:'🧭 Safari-Tabs…', search_safari_history:'🧭 Safari-Verlauf…',
  // Notion
  notion_search:'📋 Notion suchen…', notion_create_page:'📋 Notion-Seite erstellen…',
  // Obsidian
  obsidian_search:'🔮 Obsidian suchen…', obsidian_get_note:'🔮 Notiz lesen…', obsidian_create_note:'🔮 Notiz erstellen…',
  // Web & Research
  get_weather:'🌤 Wetter abrufen…',
  web_search:'🔍 Web-Suche…',
  get_news:'📰 News laden…',
  get_stock:'📈 Aktie abrufen…',
  get_crypto_price:'₿ Krypto-Kurs…', get_top_crypto:'₿ Top Coins…',
  wikipedia_search:'📚 Wikipedia suchen…', wikipedia_summary:'📚 Wikipedia lesen…',
};

async function streamChat(history, userMsg, { onChunk, onToolStatus, onToolUse } = {}) {
  const client   = getClient();
  let messages   = [...history, { role:'user', content: userMsg }];
  let fullText   = '';
  const hasTools = typeof onToolUse === 'function';

  for (let loop = 0; loop < 10; loop++) {
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: [{ type:'text', text: SYSTEM_PROMPT, cache_control:{ type:'ephemeral' } }],
      ...(hasTools ? { tools: TOOLS } : {}),
      messages,
    });

    stream.on('text', (t) => { onChunk?.(t); fullText += t; });

    const final = await stream.finalMessage();
    if (final.stop_reason !== 'tool_use') break;

    const results = [];
    for (const block of final.content) {
      if (block.type !== 'tool_use') continue;
      onToolStatus?.(TOOL_LABELS[block.name] || `🔧 ${block.name}…`);
      try {
        const res = await onToolUse(block.name, block.input);
        results.push({ type:'tool_result', tool_use_id: block.id, content: JSON.stringify(res) });
      } catch (err) {
        results.push({ type:'tool_result', tool_use_id: block.id, content: JSON.stringify({ error: err.message }), is_error: true });
      }
    }
    messages = [...messages, { role:'assistant', content: final.content }, { role:'user', content: results }];
  }

  history.push(...messages.slice(history.length));
  if (history.length > 40) history.splice(0, history.length - 40);
  return fullText;
}

module.exports = { streamChat, reinit };
