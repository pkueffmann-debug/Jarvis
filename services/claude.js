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

const SYSTEM_PROMPT = `Du bist JARVIS — ein intelligenter, proaktiver persönlicher Assistent, der auf dem Mac läuft. Du bist präzise, hilfreich und leicht witzig — wie ein echter Iron-Man-Assistent. Antworte kurz und klar, keine langen Texte außer wenn explizit gefragt.

Du hast Zugriff auf:
- Gmail (Emails lesen, schreiben, suchen)
- Google Calendar (Termine anzeigen, erstellen, löschen)
- Dateisystem (Desktop, Downloads, Dokumente durchsuchen)
- Gedächtnis (Fakten über den User speichern und abrufen)
- System-Info (Zeit, Datum, RAM, CPU, Uptime)
- Zwischenablage (lesen und schreiben)
- macOS Notifications

Antworte IMMER auf Deutsch außer der User schreibt auf Englisch. Nutze Tools proaktiv wenn sie hilfreich wären.`;

const TOOLS = [
  // ── Gmail ─────────────────────────────────────────────────────────────────
  {
    name: 'get_emails',
    description: 'Lädt Emails aus Gmail. Nutze bei allen Fragen über Emails/Nachrichten.',
    input_schema: { type:'object', properties: {
      query:      { type:'string', description:'Gmail-Query z.B. "from:thomas is:unread" oder "subject:Rechnung". Leer = Posteingang.' },
      maxResults: { type:'number', description:'Anzahl (1–20, default 10)' },
    }},
  },
  {
    name: 'get_email_content',
    description: 'Vollständigen Inhalt einer Email lesen (nutze die ID aus get_emails).',
    input_schema: { type:'object', required:['emailId'], properties: {
      emailId: { type:'string', description:'Email-ID aus get_emails' },
    }},
  },
  {
    name: 'send_email',
    description: 'Email über Gmail senden.',
    input_schema: { type:'object', required:['to','subject','body'], properties: {
      to:      { type:'string', description:'Empfänger-Adresse' },
      subject: { type:'string', description:'Betreff' },
      body:    { type:'string', description:'Email-Text' },
    }},
  },
  // ── Calendar ──────────────────────────────────────────────────────────────
  {
    name: 'get_calendar_events',
    description: 'Google Calendar Termine abrufen. Nutze bei Fragen über Termine, Schedule, heute/diese Woche.',
    input_schema: { type:'object', properties: {
      query:     { type:'string', description:'Suchbegriff (optional)' },
      maxResults:{ type:'number', description:'Anzahl (default 15)' },
      daysAhead: { type:'number', description:'Wie viele Tage vorausschauen (default 7)' },
    }},
  },
  {
    name: 'create_calendar_event',
    description: 'Neuen Termin in Google Calendar erstellen.',
    input_schema: { type:'object', required:['title','startTime'], properties: {
      title:       { type:'string', description:'Titel des Termins' },
      startTime:   { type:'string', description:'Startzeit ISO 8601 oder natürliche Sprache' },
      endTime:     { type:'string', description:'Endzeit (optional, default +1h)' },
      location:    { type:'string', description:'Ort (optional)' },
      description: { type:'string', description:'Beschreibung (optional)' },
      attendees:   { type:'array',  items:{ type:'string' }, description:'Email-Adressen der Teilnehmer' },
    }},
  },
  {
    name: 'delete_calendar_event',
    description: 'Termin aus Calendar löschen.',
    input_schema: { type:'object', required:['eventId'], properties: {
      eventId: { type:'string', description:'Event-ID aus get_calendar_events' },
    }},
  },
  // ── Memory ────────────────────────────────────────────────────────────────
  {
    name: 'remember_fact',
    description: 'Wichtige Information über den User dauerhaft merken (Präferenzen, Projekte, Personen, etc.).',
    input_schema: { type:'object', required:['key','value'], properties: {
      key:      { type:'string', description:'Eindeutiger Schlüssel z.B. "lieblingsrestaurant" oder "projekt_alpha_deadline"' },
      value:    { type:'string', description:'Was gespeichert werden soll' },
      category: { type:'string', description:'Kategorie: person | projekt | präferenz | general (default)' },
    }},
  },
  {
    name: 'recall_facts',
    description: 'Gespeicherte Informationen abrufen. Nutze dies für "erinnerst du dich..." Fragen.',
    input_schema: { type:'object', properties: {
      query: { type:'string', description:'Suchbegriff (optional, leer = alle)' },
    }},
  },
  {
    name: 'forget_fact',
    description: 'Eine gespeicherte Information löschen.',
    input_schema: { type:'object', required:['key'], properties: {
      key: { type:'string', description:'Schlüssel des zu löschenden Eintrags' },
    }},
  },
  // ── Files ─────────────────────────────────────────────────────────────────
  {
    name: 'search_files',
    description: 'Dateien auf Desktop, Downloads und Dokumente suchen.',
    input_schema: { type:'object', required:['query'], properties: {
      query:      { type:'string', description:'Dateiname oder Teil davon' },
      maxResults: { type:'number', description:'Max Treffer (default 10)' },
    }},
  },
  {
    name: 'open_file',
    description: 'Datei oder Ordner mit dem Standard-Programm öffnen.',
    input_schema: { type:'object', required:['path'], properties: {
      path: { type:'string', description:'Absoluter Pfad zur Datei' },
    }},
  },
  // ── System ────────────────────────────────────────────────────────────────
  {
    name: 'get_system_info',
    description: 'Aktuelle System-Infos: Zeit, Datum, RAM-Nutzung, CPU, Uptime.',
    input_schema: { type:'object', properties: {} },
  },
  {
    name: 'get_clipboard',
    description: 'Aktuellen Inhalt der Zwischenablage lesen.',
    input_schema: { type:'object', properties: {} },
  },
  {
    name: 'set_clipboard',
    description: 'Text in die Zwischenablage kopieren.',
    input_schema: { type:'object', required:['text'], properties: {
      text: { type:'string', description:'Text der in die Zwischenablage soll' },
    }},
  },
  {
    name: 'send_notification',
    description: 'macOS-Benachrichtigung anzeigen (für Erinnerungen, Alerts, etc.).',
    input_schema: { type:'object', required:['body'], properties: {
      title: { type:'string', description:'Titel (default: JARVIS)' },
      body:  { type:'string', description:'Nachrichtentext' },
    }},
  },
];

const TOOL_LABELS = {
  get_emails:           '📬 Gmail wird abgerufen…',
  get_email_content:    '📖 Email wird gelesen…',
  send_email:           '📤 Email wird gesendet…',
  get_calendar_events:  '📅 Kalender wird geprüft…',
  create_calendar_event:'📅 Termin wird erstellt…',
  delete_calendar_event:'🗑 Termin wird gelöscht…',
  remember_fact:        '🧠 Wird gespeichert…',
  recall_facts:         '🧠 Gedächtnis wird durchsucht…',
  forget_fact:          '🧠 Eintrag wird gelöscht…',
  search_files:         '🔍 Dateien werden gesucht…',
  open_file:            '📂 Datei wird geöffnet…',
  get_system_info:      '💻 System-Info wird abgerufen…',
  get_clipboard:        '📋 Zwischenablage wird gelesen…',
  set_clipboard:        '📋 In Zwischenablage kopieren…',
  send_notification:    '🔔 Benachrichtigung wird gesendet…',
};

/**
 * @param {Array}    history   - mutated in-place across turns
 * @param {string}   userMsg
 * @param {object}   cbs       - { onChunk, onToolStatus, onToolUse }
 * @returns {Promise<string>}  full response text
 */
async function streamChat(history, userMsg, { onChunk, onToolStatus, onToolUse } = {}) {
  const client   = getClient();
  let messages   = [...history, { role: 'user', content: userMsg }];
  let fullText   = '';
  const hasTools = typeof onToolUse === 'function';

  for (let loop = 0; loop < 8; loop++) {
    const stream = client.messages.stream({
      model:     'claude-sonnet-4-6',
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

  // Persist to history
  history.push(...messages.slice(history.length));
  if (history.length > 40) history.splice(0, history.length - 40);

  return fullText;
}

module.exports = { streamChat };
