// macOS system control — safe to require from main process only
const { exec }  = require('child_process');
const { promisify } = require('util');
const { shell } = require('electron');
const fs   = require('fs');
const os   = require('os');
const path = require('path');

const run = promisify(exec);

// Write AppleScript to temp file to avoid any escaping headaches
async function osa(script) {
  const tmp = path.join(os.tmpdir(), `jarvis-${Date.now()}.applescript`);
  fs.writeFileSync(tmp, script, 'utf8');
  try {
    const { stdout } = await run(`osascript "${tmp}"`);
    return stdout.trim();
  } finally {
    fs.unlink(tmp, () => {});
  }
}

// ── Apps & Windows ─────────────────────────────────────────────────────────

async function openApp({ appName }) {
  await run(`open -a "${appName.replace(/"/g, '\\"')}"`);
  return { opened: appName };
}

async function closeApp({ appName }) {
  await osa(`tell application "${appName}" to quit`);
  return { closed: appName };
}

async function listRunningApps() {
  const out = await osa(`tell application "System Events" to get name of every process whose background only is false`);
  const apps = out.split(', ').map((s) => s.trim()).filter(Boolean).sort();
  return { apps, count: apps.length };
}

async function switchToApp({ appName }) {
  await osa(`tell application "${appName}" to activate`);
  return { activated: appName };
}

// ── Browser ────────────────────────────────────────────────────────────────

async function openUrl({ url }) {
  const final = /^https?:\/\//i.test(url) ? url : `https://${url}`;
  await shell.openExternal(final);
  return { opened: final };
}

async function googleSearch({ query }) {
  const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  await shell.openExternal(url);
  return { searched: query };
}

// ── Messaging ──────────────────────────────────────────────────────────────

async function sendWhatsApp({ contact, message }) {
  const text = encodeURIComponent(message || '');
  // Strip non-digits for phone number, keep empty if it looks like a name
  const digits = (contact || '').replace(/\D/g, '');
  const url    = digits.length >= 6
    ? `https://wa.me/${digits}?text=${text}`
    : `whatsapp://send?text=${text}`;
  await shell.openExternal(url);
  return { opened: true, to: contact, message };
}

async function facetimeCall({ contact }) {
  await shell.openExternal(`facetime://${encodeURIComponent(contact)}`);
  return { calling: contact };
}

async function sendImessage({ contact, message }) {
  // Opens Messages.app with prefilled message via AppleScript
  await osa(`
    tell application "Messages"
      activate
      set targetBuddy to "${contact}"
      set targetService to id of 1st account whose service type = iMessage
      set textMessage to "${message.replace(/"/g, '\\"')}"
      send textMessage to buddy targetBuddy of service id targetService
    end tell
  `);
  return { sent: true, to: contact };
}

// ── Volume ─────────────────────────────────────────────────────────────────

async function setVolume({ level }) {
  if (level === 'mute' || level === 0 || level === '0') {
    await osa('set volume output muted true');
    return { muted: true };
  }
  if (level === 'unmute' || level === 'max') {
    await osa('set volume output muted false');
    if (level === 'max') await osa('set volume output volume 100');
    return { muted: false };
  }
  const vol = Math.max(0, Math.min(100, Number(level)));
  await osa(`set volume output volume ${vol}`);
  return { volume: vol };
}

// ── Brightness ─────────────────────────────────────────────────────────────

async function setBrightness({ level }) {
  // level: 0-100
  try {
    await run(`brightness ${Math.max(0, Math.min(100, Number(level))) / 100}`);
    return { brightness: level + '%' };
  } catch {
    return {
      note: '`brightness` CLI nicht gefunden.',
      hint: 'Installiere via: brew install brightness',
      workaround: 'Nutze Fn+F1 / Fn+F2 am MacBook oder System Preferences → Displays.',
    };
  }
}

// ── Screenshot ─────────────────────────────────────────────────────────────

async function takeScreenshot({ area = 'full' } = {}) {
  const name = `JARVIS-${new Date().toISOString().slice(0,19).replace(/[T:]/g,'-')}.png`;
  const dest = path.join(os.homedir(), 'Desktop', name);
  // -x = no sound, -i = interactive selection if area='select'
  const flags = area === 'select' ? '-xi' : '-x';
  await run(`screencapture ${flags} "${dest}"`);
  return { saved: dest, filename: name };
}

// ── Screen lock ────────────────────────────────────────────────────────────

async function lockScreen() {
  try {
    await run('"/System/Library/CoreServices/Menu Extras/User.menu/Contents/Resources/CGSession" -suspend');
  } catch {
    await osa('tell application "System Events" to keystroke "q" using {command down, control down}');
  }
  return { locked: true };
}

// ── Shutdown / Restart / Sleep — DANGEROUS ─────────────────────────────────

async function systemShutdown({ minutes = 0 }) {
  if (minutes > 0) {
    await run(`sudo shutdown -h +${minutes}`);
    return { scheduled: `Shutdown in ${minutes} Min.` };
  }
  await osa('tell application "System Events" to shut down');
  return { initiated: 'shutdown' };
}

async function systemRestart() {
  await osa('tell application "System Events" to restart');
  return { initiated: 'restart' };
}

async function systemSleep() {
  await osa('tell application "System Events" to sleep');
  return { initiated: 'sleep' };
}

// ── Shell execution ────────────────────────────────────────────────────────

const SAFE_RE = [
  /^ls(\s|$)/,/^find\s/,/^du\s/,/^df(\s|$)/,/^ps(\s|$)/,
  /^top\s+-l/,/^cat\s/,/^head\s/,/^tail\s/,/^grep\s/,
  /^wc\s/,/^echo\s/,/^pwd$/,/^date$/,/^uptime$/,/^whoami$/,
  /^uname/,/^hostname$/,/^mkdir\s/,/^touch\s/,/^open\s/,
  /^which\s/,/^type\s/,/^env$/,/^printenv/,/^history/,
  /^diskutil\s+list/,/^system_profiler\s/,/^sw_vers/,
];

const DANGER_RE = [
  /\brm\b.*-[rRfF]/i, /\brm\s+-[rRfF]/i, /\bsudo\b/i,
  /\bshutdown\b/i, /\breboot\b/i, /\bhalt\b/i, /\bpoweroff\b/i,
  /\bdd\s+if=/i, /\bmkfs\b/i, /\bformat\b/i,
  /curl[^|]+\|\s*(ba)?sh/i, /wget[^|]+\|\s*(ba)?sh/i,
  />\s*\/dev\//, /\bchmod\s+[0-7]*7[0-7]*/,
  /\bkillall\b/i, /\bkill\s+-9\b/i,
  /\bmv\s+.*\s+\//, /\bcp\s+.*\s+\//,
];

function classifyCommand(cmd) {
  if (DANGER_RE.some((r) => r.test(cmd))) return 'dangerous';
  if (SAFE_RE.some((r) => r.test(cmd.trim()))) return 'safe';
  return 'unknown';
}

async function executeShell({ command }) {
  const { stdout, stderr } = await run(command, {
    timeout: 20_000,
    maxBuffer: 512 * 1024,
    shell: '/bin/zsh',
  });
  return {
    output: (stdout || '').trim().slice(0, 3000) || '(kein Output)',
    error:  (stderr || '').trim().slice(0, 500)  || null,
    command,
  };
}

module.exports = {
  openApp, closeApp, listRunningApps, switchToApp,
  openUrl, googleSearch,
  sendWhatsApp, facetimeCall, sendImessage,
  setVolume, setBrightness, takeScreenshot, lockScreen,
  systemShutdown, systemRestart, systemSleep,
  executeShell, classifyCommand,
};
