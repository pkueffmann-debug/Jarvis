const Anthropic = require('@anthropic-ai/sdk');

let _client = null;

function getClient() {
  if (!_client) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('ANTHROPIC_API_KEY fehlt — bitte .env ausfüllen.');
    _client = new Anthropic({ apiKey: key });
  }
  return _client;
}

const SYSTEM_PROMPT = `Du bist JARVIS — ein intelligenter, effizienter persönlicher Assistent. Du bist präzise, hilfreich und leicht witzig. Du antwortest kurz und klar — keine langen Erklärungen außer wenn gefragt. Du hast Zugriff auf Emails und Kalender des Users. Du handelst proaktiv und fragst nach wenn etwas unklar ist. Antworte immer auf Deutsch außer der User schreibt auf Englisch.

Wenn du Emails abrufst und mehrere relevante findest, liste sie übersichtlich auf. Beim Senden einer Email immer kurz bestätigen was gesendet wurde.`;

const TOOLS = [
  {
    name: 'get_emails',
    description: 'Lädt Emails aus dem Gmail-Postfach. Nutze dies wenn nach Emails, Nachrichten oder Post gefragt wird.',
    input_schema: {
      type: 'object',
      properties: {
        query:      { type: 'string', description: 'Gmail-Suchquery z.B. "from:thomas is:unread" oder "subject:Rechnung". Leer = Posteingang.' },
        maxResults: { type: 'number', description: 'Anzahl Emails (1–20, default 10)' },
      },
    },
  },
  {
    name: 'get_email_content',
    description: 'Lädt den vollständigen Text einer Email anhand ihrer ID. Nutze dies nach get_emails um eine Email zu lesen.',
    input_schema: {
      type: 'object',
      properties: {
        emailId: { type: 'string', description: 'Die Email-ID aus get_emails' },
      },
      required: ['emailId'],
    },
  },
  {
    name: 'send_email',
    description: 'Sendet eine Email über Gmail.',
    input_schema: {
      type: 'object',
      properties: {
        to:      { type: 'string', description: 'Empfänger Email-Adresse' },
        subject: { type: 'string', description: 'Betreff der Email' },
        body:    { type: 'string', description: 'Text der Email' },
      },
      required: ['to', 'subject', 'body'],
    },
  },
];

const TOOL_LABELS = {
  get_emails:       '📬 Gmail wird abgerufen…',
  get_email_content:'📖 Email wird gelesen…',
  send_email:       '📤 Email wird gesendet…',
};

/**
 * @param {Array}    history      - conversation history (mutated in place)
 * @param {string}   userMessage
 * @param {object}   callbacks
 * @param {function} callbacks.onChunk      - called with each streamed text token
 * @param {function} callbacks.onToolStatus - called with status string when a tool runs
 * @param {function} [callbacks.onToolUse]  - async (name, input) => result — tool executor
 * @returns {Promise<string>} full assistant response text
 */
async function streamChat(history, userMessage, { onChunk, onToolStatus, onToolUse } = {}) {
  const client = getClient();

  // Build messages for this turn
  let messages = [...history, { role: 'user', content: userMessage }];
  let fullText  = '';

  const tools = onToolUse ? TOOLS : []; // only include tools if executor provided

  for (let loop = 0; loop < 6; loop++) {
    const stream = client.messages.stream({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
      ...(tools.length ? { tools } : {}),
      messages,
    });

    stream.on('text', (text) => { onChunk?.(text); fullText += text; });

    const final = await stream.finalMessage();

    if (final.stop_reason !== 'tool_use') break;

    // Execute each requested tool
    const toolResults = [];
    for (const block of final.content) {
      if (block.type !== 'tool_use') continue;

      onToolStatus?.(TOOL_LABELS[block.name] || `🔧 ${block.name}…`);

      try {
        const result = await onToolUse(block.name, block.input);
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
      } catch (err) {
        toolResults.push({
          type: 'tool_result', tool_use_id: block.id,
          content: JSON.stringify({ error: err.message }),
          is_error: true,
        });
      }
    }

    messages = [
      ...messages,
      { role: 'assistant', content: final.content },
      { role: 'user',      content: toolResults },
    ];
  }

  // Update history in-place so caller keeps multi-turn context including tool turns
  history.push(...messages.slice(history.length));
  // Keep last 40 entries to avoid runaway context
  if (history.length > 40) history.splice(0, history.length - 40);

  return fullText;
}

module.exports = { streamChat, SYSTEM_PROMPT };
