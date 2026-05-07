const { systemPreferences, shell } = require('electron');
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

function getAllStatuses() {
  const mic    = systemPreferences.getMediaAccessStatus('microphone');
  const screen = systemPreferences.getMediaAccessStatus('screen');
  const acc    = systemPreferences.isTrustedAccessibilityClient(false) ? 'granted' : 'not-determined';
  return { microphone: mic, screenRecording: screen, accessibility: acc };
}

async function requestMicrophone() {
  try {
    const granted = await systemPreferences.askForMediaAccess('microphone');
    return { granted };
  } catch {
    return { granted: false };
  }
}

const SETTINGS_URLS = {
  accessibility : 'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility',
  screen        : 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
  microphone    : 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone',
  contacts      : 'x-apple.systempreferences:com.apple.preference.security?Privacy_Contacts',
  disk          : 'x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles',
};

function openSettings(type) {
  const url = SETTINGS_URLS[type];
  if (url) shell.openExternal(url);
}

module.exports = { isFirstLaunch, markSetupComplete, getAllStatuses, requestMicrophone, openSettings };
