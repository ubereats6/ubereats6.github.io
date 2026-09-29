const {app, BrowserWindow, Menu, Tray, nativeImage, globalShortcut, ipcMain, screen} = require('electron');
const fs = require('node:fs');
const path = require('node:path');

const SCHEME = 'aniimo-egg-map';
const MIN_WIDTH = 240;
const MIN_HEIGHT = 180;
let win, tray, settingsPath, saveTimer;
let state = {mapId: null, opacity: 0.72, locked: false, bounds: null};
let quitting = false;

function mapFromArgs(args) {
  for (const value of args) {
    const match = /^aniimo-egg-map:\/\/show\/([1-9]\d{0,3})\/?$/i.exec(value);
    if (match) return Number(match[1]);
  }
  return null;
}

// The app receives only a numeric map ID. It never accepts an arbitrary URL.
const firstMap = mapFromArgs(process.argv);
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();

if (gotLock) {
  if (process.defaultApp) {
    if (process.argv[1]) app.setAsDefaultProtocolClient(SCHEME, process.execPath, [path.resolve(process.argv[1])]);
  } else {
    app.setAsDefaultProtocolClient(SCHEME);
  }

  app.on('second-instance', (_event, commandLine) => {
    const id = mapFromArgs(commandLine);
    if (id) selectMap(id);
    else if (win && !win.isDestroyed()) { win.show(); setLocked(false); }
  });

  app.whenReady().then(() => {
    settingsPath = path.join(app.getPath('userData'), 'map-hud-settings.json');
    loadSettings();
    if (firstMap) state.mapId = firstMap;
    createWindow();
    createTray();
    registerShortcuts();
  });

  app.on('activate', () => { if (win && !win.isDestroyed()) { win.show(); setLocked(false); } });
  app.on('window-all-closed', () => {}); // Tray keeps the HUD available.
  app.on('before-quit', () => { quitting = true; });
  app.on('will-quit', () => globalShortcut.unregisterAll());
}

function loadSettings() {
  try {
    const saved = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    if (Number.isInteger(saved.mapId) && saved.mapId >= 1 && saved.mapId <= 9999 && !state.mapId) state.mapId = saved.mapId;
    if (Number.isFinite(saved.opacity)) state.opacity = Math.min(1, Math.max(0.3, saved.opacity));
    state.locked = saved.locked === true;
    const b = saved.bounds;
    if (b && [b.x,b.y,b.width,b.height].every(Number.isFinite) && b.width >= MIN_WIDTH && b.height >= MIN_HEIGHT)
      state.bounds = b;
  } catch (_) { /* First launch or invalid settings: use defaults. */ }
}
function saveSettings() {
  if (!settingsPath) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (win && !win.isDestroyed()) state.bounds = win.getBounds();
    try { fs.writeFileSync(settingsPath, JSON.stringify(state)); } catch (_) { /* Keep running. */ }
  }, 200);
}
function initialBounds() {
  const area = screen.getPrimaryDisplay().workArea;
  const fallback = {x:area.x+Math.max(0,area.width-660),y:area.y+50,width:620,height:440};
  if (!state.bounds) return fallback;
  const b = state.bounds;
  const visible = screen.getAllDisplays().some(display => {
    const a=display.workArea;
    return b.x < a.x+a.width-80 && b.x+b.width > a.x+80 && b.y < a.y+a.height-60 && b.y+b.height > a.y+60;
  });
  return visible ? b : fallback;
}
function createWindow() {
  win = new BrowserWindow({
    ...initialBounds(), minWidth:MIN_WIDTH, minHeight:MIN_HEIGHT,
    frame:false, transparent:true, backgroundColor:'#00000000', alwaysOnTop:true,
    resizable:true, movable:true, show:false, skipTaskbar:false,
    opacity:state.opacity,
    icon:path.join(__dirname,'icon.png'),
    webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}
  });
  win.setMenuBarVisibility(false);
  win.setAlwaysOnTop(true,'screen-saver');
  win.webContents.setWindowOpenHandler(() => ({action:'deny'}));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.on('did-finish-load', sendState);
  win.loadFile(path.join(__dirname,'overlay.html'));
  win.once('ready-to-show', () => { win.showInactive(); setLocked(state.locked); });
  win.on('move', saveSettings);
  win.on('resize', saveSettings);
  win.on('close', event => {
    if (!quitting) { event.preventDefault(); win.hide(); updateTray(); }
  });
}
function sendState() {
  if (win && !win.isDestroyed() && !win.webContents.isLoading())
    win.webContents.send('map-state',{mapId:state.mapId,opacity:state.opacity,locked:state.locked});
}
function selectMap(id) {
  if (!Number.isInteger(id) || id < 1 || id > 9999) return;
  state.mapId = id;
  if (win && !win.isDestroyed()) { win.showInactive(); sendState(); }
  saveSettings();
  updateTray();
}
function setLocked(value) {
  state.locked = Boolean(value);
  if (win && !win.isDestroyed()) {
    win.setIgnoreMouseEvents(state.locked,{forward:true});
    win.setFocusable(!state.locked);
    if (!state.locked) { win.show(); win.focus(); }
    sendState();
  }
  updateTray();
  saveSettings();
}
function toggleVisible() {
  if (!win || win.isDestroyed()) return;
  if (win.isVisible()) win.hide();
  else { win.showInactive(); if (!state.locked) win.focus(); }
  updateTray();
}
function createTray() {
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname,'icon.png')).resize({width:16,height:16}));
  tray.on('double-click', () => { win.show(); setLocked(false); });
  updateTray();
}
function updateTray() {
  if (!tray) return;
  tray.setToolTip(`伊莫搶蛋地圖 HUD${state.mapId ? ` · 地圖 ${state.mapId}` : ''}`);
  tray.setContextMenu(Menu.buildFromTemplate([
    {label:state.locked?'調整地圖  F8':'完成・鎖定  F8',click:() => setLocked(!state.locked)},
    {label:win?.isVisible()?'隱藏  F9':'顯示  F9',click:toggleVisible},
    {type:'separator'},
    {label:'結束',click:() => app.quit()}
  ]));
}
function registerShortcuts() {
  globalShortcut.register('F8', () => setLocked(!state.locked));
  globalShortcut.register('F9', toggleVisible);
  globalShortcut.register('Control+Shift+M', () => setLocked(!state.locked));
  globalShortcut.register('Control+Shift+J', toggleVisible);
}
ipcMain.on('set-opacity', (_event,value) => {
  if (!win || !Number.isFinite(value)) return;
  state.opacity = Math.min(1,Math.max(0.3,value));
  win.setOpacity(state.opacity);
  saveSettings();
});
ipcMain.on('set-locked', (_event,value) => setLocked(value));
ipcMain.on('resize-delta', (_event,delta) => {
  if (!win || state.locked || !delta || !Number.isFinite(delta.x) || !Number.isFinite(delta.y)) return;
  const {width,height}=win.getBounds();
  win.setSize(Math.max(MIN_WIDTH,width+Math.round(delta.x)),Math.max(MIN_HEIGHT,height+Math.round(delta.y)));
});
ipcMain.on('hide-hud', toggleVisible);
