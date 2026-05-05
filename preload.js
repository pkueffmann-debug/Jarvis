const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jarvis', {
  // Send a chat message (streaming response via events below)
  sendMessage: (text) => ipcRenderer.send('send-message', text),

  // Streaming events
  onChunk: (cb) => ipcRenderer.on('jarvis-chunk', (_e, text) => cb(text)),
  onDone:  (cb) => ipcRenderer.on('jarvis-done',  (_e)       => cb()),
  onError: (cb) => ipcRenderer.on('jarvis-error', (_e, msg)  => cb(msg)),

  // Clean up listeners after each exchange
  offStream: () => {
    ipcRenderer.removeAllListeners('jarvis-chunk');
    ipcRenderer.removeAllListeners('jarvis-done');
    ipcRenderer.removeAllListeners('jarvis-error');
  },

  closeWindow: () => ipcRenderer.send('close-window'),

  // Phase 3+
  onTTSStart: (cb) => ipcRenderer.on('tts-start', () => cb()),
  onTTSEnd:   (cb) => ipcRenderer.on('tts-end',   () => cb()),
});
