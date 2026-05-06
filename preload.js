const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jarvis', {
  // ── Chat ──────────────────────────────────────────────────────────────
  sendMessage: (text) => ipcRenderer.send('send-message', text),

  onChunk:      (cb) => ipcRenderer.on('jarvis-chunk',       (_e, text)   => cb(text)),
  onDone:       (cb) => ipcRenderer.on('jarvis-done',        (_e, data)   => cb(data)),
  onError:      (cb) => ipcRenderer.on('jarvis-error',       (_e, msg)    => cb(msg)),
  onToolStatus: (cb) => ipcRenderer.on('jarvis-tool-status', (_e, status) => cb(status)),

  offStream: () => {
    ipcRenderer.removeAllListeners('jarvis-chunk');
    ipcRenderer.removeAllListeners('jarvis-done');
    ipcRenderer.removeAllListeners('jarvis-error');
    ipcRenderer.removeAllListeners('jarvis-tool-status');
  },

  // ── Voice ─────────────────────────────────────────────────────────────
  transcribeAudio: (buf, mime) => ipcRenderer.invoke('transcribe-audio', buf, mime),
  speak:           (text)      => ipcRenderer.invoke('speak', text),

  // ── Gmail ─────────────────────────────────────────────────────────────
  gmailStatus:  ()  => ipcRenderer.invoke('gmail-status'),
  gmailConnect: ()  => ipcRenderer.invoke('gmail-connect'),
  gmailRevoke:  ()  => ipcRenderer.invoke('gmail-revoke'),

  // ── Window ────────────────────────────────────────────────────────────
  closeWindow: () => ipcRenderer.send('close-window'),
});
