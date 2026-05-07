const { google } = require('googleapis');
const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const TOKEN_DIR  = path.join(os.homedir(), '.jarvis');
const TOKEN_PATH = path.join(TOKEN_DIR, 'gmail-tokens.json');
const REDIRECT   = 'http://localhost:3333/oauth/callback';

// Calendar scope added so one OAuth covers both Gmail + Calendar
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/calendar',
];

let _auth    = null;
let _openUrl = null;

function setOpenUrl(fn) { _openUrl = fn; }
function isConfigured()   { return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET); }
function isAuthenticated(){ return fs.existsSync(TOKEN_PATH); }

function makeClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    REDIRECT
  );
}

async function getAuth() {
  if (_auth) return _auth;
  if (!isConfigured()) throw new Error('GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET fehlen.');

  const client = makeClient();

  if (isAuthenticated()) {
    const saved = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
    client.setCredentials(saved);
    client.on('tokens', (t) => {
      fs.writeFileSync(TOKEN_PATH, JSON.stringify({ ...saved, ...t }));
    });
    _auth = client;
    return _auth;
  }

  if (!_openUrl) throw new Error('openUrl nicht gesetzt.');
  _auth = await runOAuthFlow(client);
  return _auth;
}

async function runOAuthFlow(client) {
  const authUrl = client.generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt: 'consent' });

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const code = new URL(req.url, 'http://localhost:3333').searchParams.get('code');
        if (!code) { res.end('Kein Code.'); return; }
        const { tokens } = await client.getToken(code);
        client.setCredentials(tokens);
        fs.mkdirSync(TOKEN_DIR, { recursive: true });
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
        res.end(`<!doctype html><html><body style="font-family:sans-serif;background:#0A0A0F;color:#fff;padding:40px;text-align:center">
          <h2 style="color:#6366F1">✅ JARVIS verbunden!</h2><p style="color:#94A3B8">Du kannst diesen Tab schließen.</p>
        </body></html>`);
        server.close();
        resolve(client);
      } catch (err) { res.end(`Fehler: ${err.message}`); server.close(); reject(err); }
    });
    server.on('error', (e) => reject(new Error(`Port 3333 belegt: ${e.message}`)));
    server.listen(3333, () => _openUrl(authUrl));
    setTimeout(() => { server.close(); reject(new Error('OAuth Timeout.')); }, 5 * 60_000);
  });
}

// ── Gmail Operations ───────────────────────────────────────────────────────

async function getEmails({ query = '', maxResults = 10 } = {}) {
  const auth  = await getAuth();
  const gm    = google.gmail({ version: 'v1', auth });
  const list  = await gm.users.messages.list({ userId: 'me', q: query || 'in:inbox', maxResults: Math.min(maxResults, 20) });
  const ids   = (list.data.messages || []).map((m) => m.id);
  if (!ids.length) return { emails: [], count: 0 };

  const emails = await Promise.all(ids.map(async (id) => {
    const msg = await gm.users.messages.get({ userId: 'me', id, format: 'metadata', metadataHeaders: ['From','Subject','Date'] });
    const h   = Object.fromEntries((msg.data.payload.headers || []).map(({ name, value }) => [name, value]));
    const m   = (h.From || '').match(/^(.*?)\s*<(.+?)>$/) || [null, h.From, h.From];
    return {
      id,
      fromName: (m[1] || '').trim().replace(/"/g, '') || m[2] || '',
      from:     (m[2] || '').trim(),
      subject:  h.Subject || '(kein Betreff)',
      date:     h.Date ? new Date(h.Date).toLocaleString('de-DE') : '',
      snippet:  (msg.data.snippet || '').replace(/&#39;/g,"'").replace(/&amp;/g,'&'),
      unread:   (msg.data.labelIds || []).includes('UNREAD'),
    };
  }));

  return { emails, count: emails.length };
}

async function getEmailContent({ emailId }) {
  const auth = await getAuth();
  const gm   = google.gmail({ version: 'v1', auth });
  const msg  = await gm.users.messages.get({ userId: 'me', id: emailId });
  const h    = Object.fromEntries((msg.data.payload.headers || []).map(({ name, value }) => [name, value]));
  gm.users.messages.modify({ userId:'me', id: emailId, requestBody:{ removeLabelIds:['UNREAD'] } }).catch(()=>{});
  return { id: emailId, from: h.From||'', subject: h.Subject||'', date: h.Date||'', body: extractBody(msg.data.payload).slice(0,4000) };
}

async function sendEmail({ to, subject, body }) {
  const auth    = await getAuth();
  const gm      = google.gmail({ version: 'v1', auth });
  const profile = await gm.users.getProfile({ userId: 'me' });
  const raw = [
    `From: ${profile.data.emailAddress}`, `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','Content-Transfer-Encoding: base64','',
    Buffer.from(body).toString('base64'),
  ].join('\r\n');
  await gm.users.messages.send({ userId:'me', requestBody:{ raw: Buffer.from(raw).toString('base64url') } });
  return { success: true, sentTo: to };
}

function extractBody(payload) {
  if (payload.body?.data) return b64d(payload.body.data);
  for (const p of payload.parts||[]) { if (p.mimeType==='text/plain'&&p.body?.data) return b64d(p.body.data); }
  for (const p of payload.parts||[]) { if (p.mimeType==='text/html'&&p.body?.data) return b64d(p.body.data).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim(); }
  for (const p of payload.parts||[]) { const r = extractBody(p); if (r) return r; }
  return '';
}

function b64d(s) { return Buffer.from(s.replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString('utf8'); }

function revokeAuth() { _auth = null; if (fs.existsSync(TOKEN_PATH)) fs.unlinkSync(TOKEN_PATH); }

module.exports = { setOpenUrl, isConfigured, isAuthenticated, getAuth, getEmails, getEmailContent, sendEmail, revokeAuth };
