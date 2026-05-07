const { exec } = require('child_process');
const { promisify } = require('util');
const run = promisify(exec);

let session = null;
let timer   = null;

async function setDND(on) {
  // macOS 13+ Focus via shortcuts, fallback to defaults
  const val = on ? 'true' : 'false';
  try {
    await run(`defaults -currentHost write com.apple.notificationcenterui doNotDisturb -boolean ${val} 2>/dev/null`);
    await run(`killall NotificationCenter 2>/dev/null || true`);
  } catch {}
}

async function startFocus({ durationMinutes = 60, blockedApps = [] } = {}) {
  if (session) await endFocus();
  await setDND(true);

  const endTime = new Date(Date.now() + durationMinutes * 60 * 1000);
  session = { startTime: new Date().toISOString(), endTime: endTime.toISOString(), durationMinutes, blockedApps };

  // Auto-end after duration
  timer = setTimeout(() => endFocus(), durationMinutes * 60 * 1000);

  return {
    started: true,
    durationMinutes,
    endsAt: endTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }),
    blockedApps,
  };
}

async function endFocus() {
  if (!session) return { error: 'Kein Focus-Modus aktiv.' };
  if (timer) { clearTimeout(timer); timer = null; }
  await setDND(false);
  const s = session;
  session = null;
  return { ended: true, hadDuration: s.durationMinutes };
}

function getStatus() {
  if (!session) return { active: false };
  const remainingMs = Math.max(0, new Date(session.endTime) - Date.now());
  const remainingMin = Math.round(remainingMs / 60000);
  return { active: true, remainingMinutes: remainingMin, ...session };
}

function isBlocked(appName) {
  if (!session) return false;
  return session.blockedApps.some((a) => a.toLowerCase() === appName.toLowerCase());
}

module.exports = { startFocus, endFocus, getStatus, isBlocked };
