const { systemPreferences, shell } = require('electron');
const { exec } = require('child_process');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const JARVIS_DIR  = path.join(os.homedir(), '.jarvis');
const SETUP_FILE  = path.join(JARVIS_DIR, '.setup-complete');

function isFirstLaunch() {
  return !fs.existsSync(SETUP_FILE);
}

function markSetupComplete() {
  if (!fs.existsSync(JARVIS_DIR)) fs.mkdirSync(JARVIS_DIR, { recursive: true });
  fs.writeFileSync(SETUP_FILE, new Date().toISOString(), 'utf8');
}

// Run a quick AppleScript and infer permission status from the result
function checkAppleScriptAccess(script) {
  return new Promise((resolve) => {
    exec(`osascript -e '${script}'`, { timeout: 5000 }, (err, _stdout, stderr) => {
      if (!err) return resolve('granted');
      const msg = ((stderr || '') + (err.message || '')).toLowerCase();
      if (
        msg.includes('not authorized') ||
        msg.includes('access denied') ||
        msg.includes('user canceled') ||
        msg.includes('1743') || // Contacts denied
        msg.includes('permissiondenied')
      ) {
        return resolve('denied');
      }
      resolve('not-determined');
    });
  });
}

// Trigger AppleScript access — this causes macOS to show the permission dialog
function triggerAppleScriptAccess(script) {
  return new Promise((resolve) => {
    exec(`osascript -e '${script}'`, { timeout: 8000 }, (err) => {
      resolve({ triggered: true, error: err?.message });
    });
  });
}

async function getAllStatuses() {
  const mic    = systemPreferences.getMediaAccessStatus('microphone');
  const camera = systemPreferences.getMediaAccessStatus('camera');
  const screen = systemPreferences.getMediaAccessStatus('screen');
  const acc    = systemPreferences.isTrustedAccessibilityClient(false) ? 'granted' : 'not-determined';

  const [contacts, calendar, reminders] = await Promise.all([
    checkAppleScriptAccess('tell application "Contacts" to return count of every person'),
    checkAppleScriptAccess('tell application "Calendar" to return count of every calendar'),
    checkAppleScriptAccess('tell application "Reminders" to return count of every list'),
  ]);

  return { microphone: mic, camera, screenRecording: screen, accessibility: acc, contacts, calendar, reminders };
}

async function requestMicrophone() {
  try {
    const granted = await systemPreferences.askForMediaAccess('microphone');
    return { granted };
  } catch { return { granted: false }; }
}

async function requestCamera() {
  try {
    const granted = await systemPreferences.askForMediaAccess('camera');
    return { granted };
  } catch { return { granted: false }; }
}

async function requestContacts() {
  await triggerAppleScriptAccess('tell application "Contacts" to return count of every person');
  const status = await checkAppleScriptAccess('tell application "Contacts" to return count of every person');
  return { granted: status === 'granted' };
}

async function requestCalendar() {
  await triggerAppleScriptAccess('tell application "Calendar" to return count of every calendar');
  const status = await checkAppleScriptAccess('tell application "Calendar" to return count of every calendar');
  return { granted: status === 'granted' };
}

async function requestReminders() {
  await triggerAppleScriptAccess('tell application "Reminders" to return count of every list');
  const status = await checkAppleScriptAccess('tell application "Reminders" to return count of every list');
  return { granted: status === 'granted' };
}

const SETTINGS_URLS = {
  accessibility: 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
  screen:        'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
  microphone:    'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
  camera:        'x-apple.systempreferences:com.apple.preference.security?Privacy_Camera',
  contacts:      'x-apple.systempreferences:com.apple.preference.security?Privacy_Contacts',
  calendar:      'x-apple.systempreferences:com.apple.preference.security?Privacy_Calendars',
  reminders:     'x-apple.systempreferences:com.apple.preference.security?Privacy_Reminders',
  photos:        'x-apple.systempreferences:com.apple.preference.security?Privacy_Photos',
  disk:          'x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles',
};

function openSettings(type) {
  const url = SETTINGS_URLS[type];
  if (url) shell.openExternal(url);
}

module.exports = {
  isFirstLaunch,
  markSetupComplete,
  getAllStatuses,
  requestMicrophone,
  requestCamera,
  requestContacts,
  requestCalendar,
  requestReminders,
  openSettings,
};
