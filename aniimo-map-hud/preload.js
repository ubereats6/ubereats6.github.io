const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('mapHud', {
  onState: callback => ipcRenderer.on('map-state', (_event,state) => callback(state)),
  setOpacity: value => ipcRenderer.send('set-opacity',value),
  setLocked: locked => ipcRenderer.send('set-locked',locked),
  resizeBy: delta => ipcRenderer.send('resize-delta',delta),
  hide: () => ipcRenderer.send('hide-hud')
});
