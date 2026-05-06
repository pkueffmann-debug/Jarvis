const { google } = require('googleapis');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const TOKEN_DIR  = path.join(os.homedir(), '.jarvis');
const TOKEN_PATH = path.join(TOKEN_DIR, 'gmail-tokens.json');
const REDIRECT   = 'http://localhost:3333/oauth/callback';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
];

let _auth     = null;
let _openUrl  = null; // injected by main.js: (url) => shell.openExternal(url)

function setOpenUrl(fn) { _openUrl = fn; }

function isConfigured() {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

function isAuthenticated() {
  return fs.existsSync(TOKEN_PATH);
}

function makeOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    REDIRECT
  );
}

async function getAuth() {
  if (_auth) return _auth;
  if (!isConfigured()) throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET fehlen.');

  const client = makeOAuth2Client();

  if (isAuthenticated()) {
    const saved = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    client.setCredentials(saved);
    // Persist refreshed tokens automatically
    client.on('tokens', (t) => {
      const merged = { ...saved, ...t };
      fs.mkdirSync(TOKEN_DIR, { recursive: true });
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(merged));
    });
    _auth = client;
    return _auth;
  }

  // First-time OAuth flow
  if (!_openUrl) throw new Error('openUrl nicht gesetzt — kann Browser nicht öffnen.');

  _auth = await runOAuthFlow(client);
  return _auth;
}

async function runOAuthFlow(client) {
  const authUrl = client.generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt: 'consent' });

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const url   = new URL(req.url, 'http://localhost:3333');
        const code  = url.searchParams.get('code');
        if (!code) { res.end('Kein Code empfangen.'); return; }

        const { tokens } = await client.getToken(code);
        client.setCredentials(tokens);

        fs.mkdirSync(TOKEN_DIR, { recursive: true });
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));

        res.end(`<!doctype html><html><body style="font-family:sans-serif;padding:40px">
          <h2>✅ JARVIS Gmail-Zugriff erfolgreich!</h2><p>Du kannst diesen Tab schließen.</p>
        </body></html>`);

        server.close();
        resolve(client);
      } catch (err) {
        res.end(`Fehler: ${err.message}`);
        server.close();
        reject(err);
      }
    });

    server.on('error', (e) => reject(new Error(`Port 3333 belegt: ${e.message}`)));
    server.listen(3333, () => _openUrl(authUrl));

    setTimeout(() => { server.close(); reject(new Error('OAuth Timeout (5 Min).'));  }, 5 * 60_000);
  });
}

// ── Gmail operations ───────────────────────────────────────────────────────

async function getEmails({ query = '', maxResults = 10 } = {}) {
  const auth   = await getAuth();
  const gmail  = google.gmail({ version: 'v1', auth });
  const listRes = await gmail.users.messages.list({
    userId: 'me',
    q: query || 'in:inbox',
    maxResults: Math.min(maxResults, 20),
  });

  const ids = (listRes.data.messages || []).map((m) => m.id);
  if (!ids.length) return { emails: [], count: 0 };

  const emails = await Promise.all(ids.map(async (id) => {
    const msg = await gmail.users.messages.get({
      userId: 'me', id,
      format: 'metadata',
      metadataHeaders: ['From', 'Subject', 'Date'],
    });
    const h = Object.fromEntries(
      (msg.data.payload.headers || []).map(({ name, value }) => [name, value])
    );
    const fromRaw   = h.From || '';
    const fromMatch = fromRaw.match(/^(.*?)\s*<(.+?)>$/) || [null, fromRaw, fromRaw];
    return {
      id,
      fromName: (fromMatch[1] || '').trim().replace(/"/g, '') || fromMatch[2] || fromRaw,
      from:     fromMatch[2]?.trim() || fromRaw,
      subject:  h.Subject || '(kein Betreff)',
      date:     h.Date ? new Date(h.Date).toLocaleString('de-DE') : '',
      snippet:  (msg.data.snippet || '').replace(/&#39;/g, "'").replace(/&amp;/g, '&'),
      unread:   (msg.data.labelIds || []).includes('UNREAD'),
    };
  }));

  return { emails, count: emails.length };
}

async function getEmailContent({ emailId }) {
  const auth  = await getAuth();
  const gmail = google.gmail({ version: 'v1', auth });

  const msg = await gmail.users.messages.get({ userId: 'me', id: emailId });
  const h   = Object.fromEntries(
    (msg.data.payload.headers || []).map(({ name, value }) => [name, value])
  );

  const body = extractBody(msg.data.payload).slice(0, 4000);

  // Mark as read
  gmail.users.messages.modify({
    userId: 'me', id: emailId,
    requestBody: { removeLabelIds: ['UNREAD'] },
  }).catch(() => {});

  return {
    id: emailId,
    from:    h.From    || '',
    subject: h.Subject || '(kein Betreff)',
    date:    h.Date    || '',
    body,
  };
}

async function sendEmail({ to, subject, body }) {
  const auth  = await getAuth();
  const gmail = google.gmail({ version: 'v1', auth });

  const profile = await gmail.users.getProfile({ userId: 'me' });
  const from    = profile.data.emailAddress;

  const raw = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
    '',
    Buffer.from(body).toString('base64'),
  ].join('\r\n');

  await gmail.users.messages.send({
    userId: 'me',
    requestBody: { raw: Buffer.from(raw).toString('base64url') },
  });

  return { success: true, sentTo: to };
}

function extractBody(payload) {
  if (payload.body?.data) return b64decode(payload.body.data);
  for (const part of payload.parts || []) {
    if (part.mimeType === 'text/plain' && part.body?.data) return b64decode(part.body.data);
  }
  for (const part of payload.parts || []) {
    if (part.mimeType === 'text/html' && part.body?.data) {
      return b64decode(part.body.data).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }
  for (const part of payload.parts || []) {
    const r = extractBody(part);
    if (r) return r;
  }
  return '';
}

function b64decode(str) {
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

// ── Revoke ─────────────────────────────────────────────────────────────────

function revokeAuth() {
  _auth = null;
  if (fs.existsSync(TOKEN_PATH)) fs.unlinkSync(TOKEN_PATH);
}

module.exports = { setOpenUrl, isConfigured, isAuthenticated, getAuth, getEmails, getEmailContent, sendEmail, revokeAuth };
