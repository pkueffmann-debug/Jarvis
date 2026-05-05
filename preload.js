const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jarvis', {
  // ── Chat ──────────────────────────────────────────────────────────────
  sendMessage: (text) => ipcRenderer.send('send-message', text),

  onChunk: (cb) => ipcRenderer.on('jarvis-chunk', (_e, text) => cb(text)),
  onDone:  (cb) => ipcRenderer.on('jarvis-done',  (_e, data) => cb(data)),
  onError: (cb) => ipcRenderer.on('jarvis-error', (_e, msg)  => cb(msg)),
  offStream: () => {
    ipcRenderer.removeAllListeners('jarvis-chunk');
    ipcRenderer.removeAllListeners('jarvis-done');
    ipcRenderer.removeAllListeners('jarvis-error');
  },

  // ── Voice ─────────────────────────────────────────────────────────────
  // STT: send ArrayBuffer, receive transcribed string
  transcribeAudio: (audioData, mimeType) =>
    ipcRenderer.invoke('transcribe-audio', audioData, mimeType),

  // TTS: send text, receive base64 MP3 string (or null if not configured)
  speak: (text) => ipcRenderer.invoke('speak', text),

  // ── Window ────────────────────────────────────────────────────────────
  closeWindow: () => ipcRenderer.send('close-window'),
});
