let autoUpdater = null;
try {
  autoUpdater = require('electron-updater').autoUpdater;
} catch {
  // electron-updater not available in this build — updates disabled
}

let _win = null;

function push(channel, data) {
  _win?.webContents.send(channel, data);
}

function init(mainWindow) {
  _win = mainWindow;

  if (!autoUpdater) return;
  if (process.env.NODE_ENV === 'development') return;

  autoUpdater.autoDownload         = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update',  ()  => push('update-status', { status: 'checking' }));
  autoUpdater.on('update-available',     (i) => push('update-status', { status: 'available', version: i.version }));
  autoUpdater.on('update-not-available', ()  => push('update-status', { status: 'current' }));
  autoUpdater.on('download-progress',    (p) => push('update-status', { status: 'downloading', percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded',    (i) => {
    push('update-status', { status: 'ready', version: i.version });
    push('jarvis-proactive', `🆕 JARVIS ${i.version} ist bereit. Beim nächsten Neustart wird es installiert.`);
  });
  autoUpdater.on('error', (e) => {
    console.error('[Updater]', e.message);
    push('update-status', { status: 'error', message: e.message });
  });

  setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 5000);
  setInterval(() => autoUpdater.checkForUpdates().catch(() => {}), 4 * 60 * 60 * 1000);
}

function installNow() {
  autoUpdater?.quitAndInstall(false, true);
}

module.exports = { init, installNow };
