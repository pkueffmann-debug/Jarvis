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

const SYSTEM_PROMPT = `Du bist JARVIS — ein intelligenter, effizienter persönlicher Assistent. Du bist präzise, hilfreich und leicht witzig. Du antwortest kurz und klar — keine langen Erklärungen außer wenn gefragt. Du hast Zugriff auf Emails, Kalender und Dateien des Users. Du handelst proaktiv und fragst nach wenn etwas unklar ist. Antworte immer auf Deutsch außer der User schreibt auf Englisch.`;

/**
 * Streams a Claude response.
 * @param {Array<{role:string, content:string}>} history
 * @param {string} userMessage
 * @param {(chunk: string) => void} onChunk  called for each text token
 * @returns {Promise<string>} full response text
 */
async function streamChat(history, userMessage, onChunk) {
  const client = getClient();
  let fullText = '';

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    // Cache the system prompt across turns (prompt caching)
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [...history, { role: 'user', content: userMessage }],
  });

  stream.on('text', (text) => {
    onChunk(text);
    fullText += text;
  });

  await stream.finalMessage();
  return fullText;
}

module.exports = { streamChat, SYSTEM_PROMPT };
