const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('setup', {
  checkPermissions : ()     => ipcRenderer.invoke('perm-check'),
  requestMicrophone: ()     => ipcRenderer.invoke('perm-request-mic'),
  openSettings     : (type) => ipcRenderer.invoke('perm-open-settings', type),
  complete         : ()     => ipcRenderer.invoke('perm-complete'),
});
