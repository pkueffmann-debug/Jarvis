const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jarvis', {
  // Chat
  sendMessage:  (text) => ipcRenderer.send('send-message', text),
  onChunk:      (cb)   => ipcRenderer.on('jarvis-chunk',       (_e,t) => cb(t)),
  onDone:       (cb)   => ipcRenderer.on('jarvis-done',        (_e,d) => cb(d)),
  onError:      (cb)   => ipcRenderer.on('jarvis-error',       (_e,m) => cb(m)),
  onToolStatus: (cb)   => ipcRenderer.on('jarvis-tool-status', (_e,s) => cb(s)),
  offStream: () => {
    ['jarvis-chunk','jarvis-done','jarvis-error','jarvis-tool-status']
      .forEach((e) => ipcRenderer.removeAllListeners(e));
  },

  // Confirmation dialog
  onConfirm:     (cb)       => ipcRenderer.on('jarvis-confirm', (_e,d) => cb(d)),
  offConfirm:    ()         => ipcRenderer.removeAllListeners('jarvis-confirm'),
  confirmAction: (confirmed) => ipcRenderer.send('confirm-action', confirmed),

  // Voice
  transcribeAudio: (buf, mime) => ipcRenderer.invoke('transcribe-audio', buf, mime),
  speak:           (text)      => ipcRenderer.invoke('speak', text),

  // Google
  googleStatus:  () => ipcRenderer.invoke('google-status'),
  googleConnect: () => ipcRenderer.invoke('google-connect'),
  googleRevoke:  () => ipcRenderer.invoke('google-revoke'),

  // Memory
  memoryStats:  () => ipcRenderer.invoke('memory-stats'),
  memoryClear:  () => ipcRenderer.invoke('memory-clear'),
  historyClear: () => ipcRenderer.invoke('history-clear'),

  // Config
  configStatus: () => ipcRenderer.invoke('config-status'),
  configGet:    (key)        => ipcRenderer.invoke('config-get', key),
  configSet:    (key, value) => ipcRenderer.invoke('config-set', key, value),

  // Proactive messages
  onProactiveMessage: (cb) => ipcRenderer.on('jarvis-proactive', (_e, text) => cb(text)),
  offProactive: () => ipcRenderer.removeAllListeners('jarvis-proactive'),

  // Window
  closeWindow: () => ipcRenderer.send('close-window'),

  // Wake Word
  wakeWordStart:       ()        => ipcRenderer.invoke('wake-word-start'),
  wakeWordStop:        ()        => ipcRenderer.invoke('wake-word-stop'),
  wakeWordStatus:      ()        => ipcRenderer.invoke('wake-word-status'),
  sendWakeWordFrame:   (samples) => ipcRenderer.send('wake-word-frame', samples),
  onWakeWordDetected:  (cb)      => ipcRenderer.on('wake-word-detected', () => cb()),
  offWakeWordDetected: ()        => ipcRenderer.removeAllListeners('wake-word-detected'),

  // Auto-updater
  updateInstall: () => ipcRenderer.invoke('update-install'),
  onUpdateAvailable: (cb) => ipcRenderer.on('update-available', (_e,info) => cb(info)),
  onUpdateDownloaded: (cb) => ipcRenderer.on('update-downloaded', (_e,info) => cb(info)),

  // License / Paywall
  licenseStatus:   ()        => ipcRenderer.invoke('license-status'),
  licenseActivate: (key)     => ipcRenderer.invoke('license-activate', key),
  licenseCheckout: (plan)    => ipcRenderer.invoke('license-checkout', plan),
  licenseRevoke:   ()        => ipcRenderer.invoke('license-revoke'),
  onPaywall:       (cb)      => ipcRenderer.on('jarvis-paywall', (_e, s) => cb(s)),
  offPaywall:      ()        => ipcRenderer.removeAllListeners('jarvis-paywall'),

  // Open URL in default browser
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
});
