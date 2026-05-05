const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('jarvis', {
  sendMessage: (message) => ipcRenderer.invoke('send-message', message),
  closeWindow: () => ipcRenderer.send('close-window'),

  // Phase 3+: voice / TTS callbacks
  onTTSStart: (cb) => ipcRenderer.on('tts-start', () => cb()),
  onTTSEnd: (cb) => ipcRenderer.on('tts-end', () => cb()),
});
