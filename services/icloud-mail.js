// iCloud Mail via IMAP (imap.mail.me.com:993) + SMTP (smtp.mail.me.com:587)
// Requires: ICLOUD_EMAIL + ICLOUD_APP_PASSWORD in env/config
// App-specific password: https://appleid.apple.com → Sign-In & Security → App Passwords

const net   = require('net');
const tls   = require('tls');
const os    = require('os');

const IMAP_HOST  = 'imap.mail.me.com';
const IMAP_PORT  = 993;
const SMTP_HOST  = 'smtp.mail.me.com';
const SMTP_PORT  = 587;

function getCredentials() {
  const email    = process.env.ICLOUD_EMAIL;
  const password = process.env.ICLOUD_APP_PASSWORD;
  if (!email || !password) throw new Error('ICLOUD_EMAIL oder ICLOUD_APP_PASSWORD fehlt — bitte in Einstellungen eintragen.');
  return { email, password };
}

function isConfigured() {
  return !!(process.env.ICLOUD_EMAIL && process.env.ICLOUD_APP_PASSWORD);
}

// ── Minimal IMAP client ───────────────────────────────────────────────────────
class MinimalIMAP {
  constructor(email, password) {
    this.email    = email;
    this.password = password;
    this.socket   = null;
    this.tag      = 0;
    this.buf      = '';
    this.pending  = new Map();
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.socket = tls.connect({ host: IMAP_HOST, port: IMAP_PORT }, () => {
        this.socket.setEncoding('utf8');
        this.socket.on('data', d => this._onData(d));
        this.socket.on('error', e => reject(e));
      });
      this.socket.once('data', () => resolve());
      this.socket.on('error', reject);
    });
  }

  _onData(chunk) {
    this.buf += chunk;
    const lines = this.buf.split('\r\n');
    this.buf = lines.pop();
    for (const line of lines) {
      this.pending.forEach((cb, tag) => {
        if (line.startsWith(tag + ' ')) cb(null, line);
      });
    }
  }

  cmd(str) {
    return new Promise((resolve, reject) => {
      const tag = `T${++this.tag}`;
      let resp = '';
      this.pending.set(tag, (err, line) => {
        if (err) { this.pending.delete(tag); return reject(err); }
        resp += line + '\n';
        if (line.startsWith(tag + ' OK') || line.startsWith(tag + ' NO') || line.startsWith(tag + ' BAD')) {
          this.pending.delete(tag);
          if (line.startsWith(tag + ' OK')) resolve(resp);
          else reject(new Error(line));
        }
      });
      // Also capture untagged responses
      const rawListener = (d) => { resp += d; };
      this.socket.on('data', rawListener);
      setTimeout(() => this.socket.removeListener('data', rawListener), 15000);
      this.socket.write(`${tag} ${str}\r\n`);
    });
  }

  async login() {
    await this.cmd(`LOGIN "${this.email}" "${this.password}"`);
  }

  async logout() {
    try { await this.cmd('LOGOUT'); } catch {}
    this.socket?.destroy();
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

async function getEmails({ folder = 'INBOX', limit = 10, query = '' } = {}) {
  if (!isConfigured()) return { error: 'iCloud Mail nicht konfiguriert.', emails: [] };
  const { email, password } = getCredentials();

  // Use imapflow if available, otherwise return config instructions
  try {
    const { ImapFlow } = require('imapflow');
    const client = new ImapFlow({
      host: IMAP_HOST, port: IMAP_PORT, secure: true,
      auth: { user: email, pass: password },
      logger: false,
    });

    await client.connect();
    const lock = await client.getMailboxLock(folder);
    try {
      const messages = [];
      const from = Math.max(1, client.mailbox.exists - limit + 1);
      for await (const msg of client.fetch(`${from}:*`, { envelope: true, bodyStructure: true })) {
        if (query) {
          const subj = msg.envelope.subject || '';
          const fromAddr = msg.envelope.from?.[0]?.address || '';
          if (!subj.toLowerCase().includes(query.toLowerCase()) && !fromAddr.toLowerCase().includes(query.toLowerCase())) continue;
        }
        messages.push({
          id:      msg.uid,
          subject: msg.envelope.subject || '(kein Betreff)',
          from:    msg.envelope.from?.[0] ? `${msg.envelope.from[0].name || ''} <${msg.envelope.from[0].address}>`.trim() : '',
          date:    msg.envelope.date,
          seen:    !!msg.flags?.has('\\Seen'),
        });
      }
      return { emails: messages.slice(-limit).reverse() };
    } finally {
      lock.release();
      await client.logout();
    }
  } catch (e) {
    if (e.code === 'MODULE_NOT_FOUND') {
      return { error: 'imapflow nicht installiert. Bitte: npm install imapflow', emails: [] };
    }
    return { error: e.message, emails: [] };
  }
}

async function getEmailContent({ uid, folder = 'INBOX' } = {}) {
  if (!isConfigured()) return { error: 'iCloud Mail nicht konfiguriert.' };
  const { email, password } = getCredentials();
  try {
    const { ImapFlow } = require('imapflow');
    const client = new ImapFlow({
      host: IMAP_HOST, port: IMAP_PORT, secure: true,
      auth: { user: email, pass: password }, logger: false,
    });
    await client.connect();
    const lock = await client.getMailboxLock(folder);
    try {
      const msg = await client.fetchOne(String(uid), { source: true }, { uid: true });
      const source = msg?.source?.toString() || '';
      // Extract plain text body (simplified)
      const textMatch = source.match(/Content-Type: text\/plain[^\n]*\n\n([\s\S]*?)(?:\n--|\n\n--)/i);
      const body = textMatch ? textMatch[1].trim() : source.slice(0, 2000);
      return { uid, body };
    } finally {
      lock.release();
      await client.logout();
    }
  } catch (e) {
    return { error: e.message };
  }
}

async function sendEmail({ to, subject, body } = {}) {
  if (!isConfigured()) return { error: 'iCloud Mail nicht konfiguriert.' };
  const { email, password } = getCredentials();
  try {
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST, port: SMTP_PORT, secure: false,
      auth: { user: email, pass: password },
      tls: { rejectUnauthorized: false },
    });
    await transporter.sendMail({ from: email, to, subject, text: body });
    return { sent: true };
  } catch (e) {
    return { error: e.message };
  }
}

module.exports = { isConfigured, getEmails, getEmailContent, sendEmail };
