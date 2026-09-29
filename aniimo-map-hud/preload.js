const {contextBridge, ipcRenderer} = require('electron');
contextBridge.exposeInMainWorld('mapHud', {
  onState: callback => ipcRenderer.on('map-state', (_event,state) => callback(state)),
  setOpacity: value => ipcRenderer.send('set-opacity',value),
  setLocked: locked => ipcRenderer.send('set-locked',locked),
  resizeBy: delta => ipcRenderer.send('resize-delta',delta),
  hide: () => ipcRenderer.send('hide-hud'),
  openMatcher: () => ipcRenderer.send('open-matcher'),
  captureSources: () => ipcRenderer.invoke('capture-sources'),
  matchResults: ids => ipcRenderer.send('match-results', ids),
  chooseMatch: id => ipcRenderer.send('choose-match', id),
  selectCandidate: id => ipcRenderer.send('select-candidate', id)
});
