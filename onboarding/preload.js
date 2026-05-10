const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('setup', {
  checkPermissions:  ()          => ipcRenderer.invoke('perm-check'),
  requestMicrophone: ()          => ipcRenderer.invoke('perm-request-mic'),
  requestCamera:     ()          => ipcRenderer.invoke('perm-request-camera'),
  requestContacts:   ()          => ipcRenderer.invoke('perm-request-contacts'),
  requestCalendar:   ()          => ipcRenderer.invoke('perm-request-calendar'),
  requestReminders:  ()          => ipcRenderer.invoke('perm-request-reminders'),
  openSettings:      (type)      => ipcRenderer.invoke('perm-open-settings', type),
  complete:          ()          => ipcRenderer.invoke('perm-complete'),
  setConfig:         (key, val)  => ipcRenderer.invoke('config-set', key, val),
  googleConnect:     ()          => ipcRenderer.invoke('google-connect'),
});
