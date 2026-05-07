const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jarvis', {
  // ── Chat ──────────────────────────────────────────────────────────────
  sendMessage:  (text) => ipcRenderer.send('send-message', text),
  onChunk:      (cb)   => ipcRenderer.on('jarvis-chunk',       (_e,t) => cb(t)),
  onDone:       (cb)   => ipcRenderer.on('jarvis-done',        (_e,d) => cb(d)),
  onError:      (cb)   => ipcRenderer.on('jarvis-error',       (_e,m) => cb(m)),
  onToolStatus: (cb)   => ipcRenderer.on('jarvis-tool-status', (_e,s) => cb(s)),
  offStream: () => {
    ['jarvis-chunk','jarvis-done','jarvis-error','jarvis-tool-status']
      .forEach((e) => ipcRenderer.removeAllListeners(e));
  },

  // ── Confirmation dialog ────────────────────────────────────────────────
  onConfirm:     (cb)       => ipcRenderer.on('jarvis-confirm', (_e,d) => cb(d)),
  offConfirm:    ()         => ipcRenderer.removeAllListeners('jarvis-confirm'),
  confirmAction: (confirmed) => ipcRenderer.send('confirm-action', confirmed),

  // ── Voice ─────────────────────────────────────────────────────────────
  transcribeAudio: (buf, mime) => ipcRenderer.invoke('transcribe-audio', buf, mime),
  speak:           (text)      => ipcRenderer.invoke('speak', text),

  // ── Google ────────────────────────────────────────────────────────────
  googleStatus:  () => ipcRenderer.invoke('google-status'),
  googleConnect: () => ipcRenderer.invoke('google-connect'),
  googleRevoke:  () => ipcRenderer.invoke('google-revoke'),

  // ── Memory ────────────────────────────────────────────────────────────
  memoryStats:  () => ipcRenderer.invoke('memory-stats'),
  memoryClear:  () => ipcRenderer.invoke('memory-clear'),
  historyClear: () => ipcRenderer.invoke('history-clear'),

  // ── Config ────────────────────────────────────────────────────────────
  configStatus: () => ipcRenderer.invoke('config-status'),

  // ── Proactive messages ────────────────────────────────────────────────
  onProactiveMessage: (cb) => ipcRenderer.on('jarvis-proactive', (_e, text) => cb(text)),
  offProactive: () => ipcRenderer.removeAllListeners('jarvis-proactive'),

  // ── Window ────────────────────────────────────────────────────────────
  closeWindow: () => ipcRenderer.send('close-window'),
});
