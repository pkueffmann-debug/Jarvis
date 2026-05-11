const cron  = require('node-cron');
const https = require('https');
const http  = require('http');

let _win      = null;
let _gmail    = null;
let _calendar = null;
let _notify   = null;
let _briefingEnabled = true;

const notifiedMeetings = new Set();

function setBriefingEnabled(val) { _briefingEnabled = val; }
function isBriefingEnabled()     { return _briefingEnabled; }

function init({ mainWindow, gmail, calendar, notifyRecord, briefingEnabled = true }) {
  _win              = mainWindow;
  _gmail            = gmail;
  _calendar         = calendar;
  _notify           = notifyRecord;
  _briefingEnabled  = briefingEnabled;

  scheduleDaily();
  scheduleMeetingWatcher();
}

async function speakText(text) {
  const apiKey  = process.env.ELEVENLABS_API_KEY;
  const voiceId = process.env.ELEVENLABS_VOICE_ID;
  if (!apiKey || !voiceId) return;

  const body = JSON.stringify({ text, model_id: 'eleven_turbo_v2', voice_settings: { stability: 0.5, similarity_boost: 0.75 } });

  return new Promise((resolve) => {
    const req = https.request(
      { hostname: 'api.elevenlabs.io', path: `/v1/text-to-speech/${voiceId}`, method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' } },
      (res) => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          _win?.webContents.send('jarvis-speak-buffer', buf.toString('base64'));
          resolve();
        });
      }
    );
    req.on('error', resolve);
    req.write(body);
    req.end();
  });
}

// Push a proactive message into the JARVIS chat window
function push(text, { speak = false } = {}) {
  if (!_win) return;
  const { Notification } = require('electron');
  _notify?.(null, text);
  new Notification({ title: 'JARVIS', body: text.slice(0, 100) }).show();
  _win.webContents.send('jarvis-proactive', text);
  if (speak) speakText(text).catch(() => {});
}

function scheduleDaily() {
  const morning = process.env.JARVIS_MORNING_BRIEFING_TIME || '08:00';
  const evening = process.env.JARVIS_EVENING_SUMMARY_TIME || '18:00';

  const [mH, mM] = morning.split(':');
  const [eH, eM] = evening.split(':');

  cron.schedule(`${mM} ${mH} * * *`, async () => {
    if (!_briefingEnabled) return;
    try {
      const text = await buildMorningBriefing();
      push(text, { speak: true });
    } catch (e) { console.error('[Proactive] morning:', e.message); }
  });

  cron.schedule(`${eM} ${eH} * * *`, () => {
    if (!_briefingEnabled) return;
    const name = process.env.JARVIS_OWNER_NAME || 'Paul';
    push(`🌆 Guten Abend, ${name}! Dein Tag geht zu Ende. Was soll ich für morgen vorbereiten?`);
  });
}

function scheduleMeetingWatcher() {
  cron.schedule('* * * * *', async () => {
    try {
      if (!_calendar || !(_gmail?.isConfigured?.() && _gmail?.isAuthenticated?.())) return;

      const events = await _calendar.getEvents({ daysAhead: 1 });
      if (!events?.events?.length) return;

      const now = Date.now();
      for (const ev of events.events) {
        const start = new Date(ev.start).getTime();
        const minutesUntil = (start - now) / 60000;
        if (minutesUntil >= 4 && minutesUntil < 6) {
          const key = ev.id + ev.start;
          if (!notifiedMeetings.has(key)) {
            notifiedMeetings.add(key);
            const loc = ev.location ? ` 📍 ${ev.location}` : '';
            push(`⏰ In 5 Minuten: "${ev.title}"${loc}`);
          }
        }
      }
      // Prevent set growing indefinitely
      if (notifiedMeetings.size > 500) notifiedMeetings.clear();
    } catch {}
  });
}

async function buildMorningBriefing() {
  const name = process.env.JARVIS_OWNER_NAME || 'Paul';
  const time = new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  const parts = [`☀️ Guten Morgen, ${name}! Es ist ${time}.`];

  try {
    if (_calendar && _gmail?.isConfigured?.() && _gmail?.isAuthenticated?.()) {
      const res = await _calendar.getEvents({ daysAhead: 1 });
      if (res?.events?.length) {
        const first = res.events[0];
        const t = new Date(first.start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        parts.push(`📅 ${res.events.length} Termin(e) heute. Erster: "${first.title}" um ${t}.`);
      } else {
        parts.push('📅 Heute keine Termine.');
      }
    }
  } catch {}

  try {
    if (_gmail?.isConfigured?.() && _gmail?.isAuthenticated?.()) {
      const res = await _gmail.getEmails({ query: 'is:unread', maxResults: 5 });
      if (res?.emails?.length) {
        const from = res.emails[0].from?.split('<')[0].trim();
        parts.push(`📬 ${res.emails.length} ungelesene E-Mail(s). Erste von: ${from}.`);
      }
    }
  } catch {}

  return parts.join('\n');
}

module.exports = { init, push, setBriefingEnabled, isBriefingEnabled };
