const {app, BrowserWindow, Menu, Tray, nativeImage, globalShortcut, ipcMain, screen, desktopCapturer, session} = require('electron');
const fs = require('node:fs');
const path = require('node:path');

let manifest = require('./maps.json');
const {Database}=require('./database');
let database,activeDatabase,pendingDatabase,databaseStatus='使用內建地圖';
const mapIndex = new Map(manifest.maps.map(m => [m.id,m]));
const validDifficulty = value => manifest.difficulties.some(d => d.id === value);
const SCHEME = 'aniimo-egg-map';
const MIN_WIDTH = 320;
const MIN_HEIGHT = 300;
let win, workWin, tray, settingsPath, saveTimer;
let state = {mapId: null, opacity: 0.72, locked: false, bounds: null, candidates: [], difficulty: null};
let quitting = false;
let allowedSources=new Map(), pendingCaptureId=null;

function mapFromArgs(args) {
  for (const value of args) {
    const match = /^aniimo-egg-map:\/\/show\/([1-9]\d{0,3})\/?$/i.exec(value);
    if (match && mapIndex.has(Number(match[1]))) return Number(match[1]);
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
    database=new Database(__dirname,path.join(app.getPath('userData'),'map-database'));
    activeDatabase=database.current;refreshManifest(activeDatabase);
    loadSettings();
    const launchMap=mapFromArgs(process.argv);if (launchMap) {state.mapId=launchMap;state.difficulty=mapIndex.get(launchMap).difficulty;}
    installDisplayCapture();
    createWindow();
    createTray();
    registerShortcuts();
    checkDatabase();
  });

  app.on('activate', () => { if (win && !win.isDestroyed()) { win.show(); setLocked(false); } });
  app.on('window-all-closed', () => {}); // Tray keeps the HUD available.
  app.on('before-quit', () => { quitting = true; });
  app.on('will-quit', () => globalShortcut.unregisterAll());
}

function loadSettings() {
  try {
    const saved = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    if (Number.isInteger(saved.mapId) && mapIndex.has(saved.mapId) && !state.mapId) state.mapId = saved.mapId;
    if (Number.isFinite(saved.opacity)) state.opacity = Math.min(1, Math.max(0.3, saved.opacity));
    state.locked=false;
    if(validDifficulty(saved.difficulty))state.difficulty=saved.difficulty;
    else if(state.mapId)state.difficulty=mapIndex.get(state.mapId).difficulty;
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
  const fallback = {x:area.x+Math.max(0,area.width-660),y:area.y+50,width:620,height:520};
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
    icon:path.join(__dirname,'icon.ico'),
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
  for(const target of [win,workWin])
    if(target && !target.isDestroyed() && !target.webContents.isLoading())
      target.webContents.send('map-state',{mapId:state.mapId,opacity:state.opacity,locked:state.locked,candidates:state.candidates,difficulty:state.difficulty});
}
function selectMap(id, keepCandidates=false) {
  if (!mapIndex.has(id)) return;
  state.mapId = id;
  state.difficulty=mapIndex.get(id).difficulty;
  if (!keepCandidates) state.candidates = [];
  if (win && !win.isDestroyed()) { win.showInactive(); sendState(); }
  saveSettings();
  updateTray();
}
function openMatcher() {
  if (workWin && !workWin.isDestroyed()) { workWin.webContents.send('restart-flow'); workWin.show(); workWin.focus(); return; }
  workWin = new BrowserWindow({
    width:620,height:300,minWidth:560,minHeight:280,frame:false,
    title:'伊莫搶蛋地圖辨識',icon:path.join(__dirname,'icon.ico'),
    backgroundColor:'#071426',autoHideMenuBar:true,
    webPreferences:{preload:path.join(__dirname,'preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true}
  });
  workWin.webContents.setWindowOpenHandler(() => ({action:'deny'}));
  workWin.webContents.on('will-navigate',event => event.preventDefault());
  workWin.webContents.on('did-finish-load',sendState);
  workWin.loadFile(path.join(__dirname,'matcher.html'));
  workWin.on('closed',() => { workWin=null;pendingCaptureId=null;allowedSources.clear();if(pendingDatabase)activateDatabase(pendingDatabase); });
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
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname,'icon.ico')).resize({width:32,height:32}));
  tray.on('double-click', () => { win.show(); setLocked(false); });
  updateTray();
}
function updateTray() {
  if (!tray) return;
  tray.setToolTip(`伊莫搶蛋地圖 HUD${state.mapId ? ` · 地圖 ${state.mapId}` : ''}`);
  tray.setContextMenu(Menu.buildFromTemplate([
    {label:'擷取並辨識地圖',click:openMatcher},
    {type:'separator'},
    {label:state.locked?'調整地圖  F8':'鎖定  F8',click:() => setLocked(!state.locked)},
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
ipcMain.on('open-matcher',event => { if (event.sender===win?.webContents) openMatcher(); });
function installDisplayCapture(){
  session.defaultSession.setDisplayMediaRequestHandler(async(request,callback)=>{
    const frame=workWin?.webContents.mainFrame;
    if(!frame || !request.frame || request.frame.processId!==frame.processId || request.frame.routingId!==frame.routingId ||
       !request.videoRequested || request.audioRequested || !pendingCaptureId){callback({});return;}
    const id=pendingCaptureId;pendingCaptureId=null;
    try{
      const sources=await desktopCapturer.getSources({types:['window','screen'],thumbnailSize:{width:0,height:0}});
      const selected=sources.find(source=>source.id===id);
      if(!workWin || workWin.isDestroyed() || !selected){callback({});return;}
      callback({video:selected});
    }catch(_){callback({});}
  },{useSystemPicker:false});
}
ipcMain.handle('capture-sources',async event=>{
  if(event.sender!==workWin?.webContents || !validDifficulty(state.difficulty))return [];
  // Keep the chooser visible. Each source receives a thumbnail, then the user selects one.
  const sources=await desktopCapturer.getSources({types:['window','screen'],thumbnailSize:{width:640,height:360}});
  const filtered=sources.filter(s=>s.name!=='伊莫搶蛋地圖辨識' && s.name!=='伊莫搶蛋地圖 HUD')
    .filter(s=>!s.thumbnail.isEmpty());
  allowedSources=new Map(filtered.map(s=>[s.id,s]));
  return filtered.map(s=>({id:s.id,name:s.name,shot:s.thumbnail.toDataURL()}));
});
ipcMain.handle('select-live-source',(event,id)=>{
  if(event.sender!==workWin?.webContents || !allowedSources.has(id))return false;
  pendingCaptureId=id;return true;
});
ipcMain.on('stop-live-source',event=>{if(event.sender===workWin?.webContents)pendingCaptureId=null;});
ipcMain.on('matcher-step',(event,step)=>{
  if(event.sender!==workWin?.webContents || !['mode','door','source','crop'].includes(step))return;
  const area=screen.getDisplayMatching(workWin.getBounds()).workArea;
  const size=step==='mode'?{w:620,h:300}:step==='door'?{w:940,h:890}:step==='source'?{w:820,h:650}:{w:960,h:820};
  workWin.setMinimumSize(Math.min(step==='door'?900:560,area.width-24),Math.min(step==='mode'?280:340,area.height-24));
  workWin.setSize(Math.min(size.w,area.width-24),Math.min(size.h,area.height-24));workWin.center();
});
ipcMain.on('choose-match', (event,id) => {
  if (event.sender!==workWin?.webContents || !Number.isInteger(id) || id<1 || id>9999) return;
  if (!state.candidates.includes(id)) return;
  selectMap(id,true);
  if (workWin && !workWin.isDestroyed()) workWin.close();
  setLocked(false);
});
ipcMain.on('set-difficulty', (event,difficulty) => {
  if(event.sender!==workWin?.webContents || !validDifficulty(difficulty) || state.difficulty===difficulty)return;
  state.difficulty=difficulty;state.candidates=[];sendState();saveSettings();
});
ipcMain.on('clear-matches',event=>{
  if(event.sender!==workWin?.webContents)return;
  state.candidates=[];sendState();
});
ipcMain.on('match-results', (event,payload) => {
  const {ids,difficulty}=payload||{};
  if(difficulty!==state.difficulty)return;
  if (event.sender!==workWin?.webContents || !Array.isArray(ids) || ids.length<1 || ids.length>5000 ||
      !ids.every(id=>Number.isInteger(id) && mapIndex.has(id) && mapIndex.get(id).difficulty===difficulty) || new Set(ids).size!==ids.length) return;
  state.candidates=ids;
  sendState();
});
ipcMain.on('select-candidate', (event,id) => {
  if (event.sender!==win?.webContents || state.locked || !state.candidates.includes(id)) return;
  selectMap(id,true);
});

function refreshManifest(data){manifest=data.manifest;mapIndex.clear();for(const m of manifest.maps)mapIndex.set(m.id,m);}
function broadcastDatabase(text){databaseStatus=text;for(const target of [win,workWin])if(target&&!target.isDestroyed())target.webContents.send('database-status',text);}
function activateDatabase(data){
 pendingDatabase=null;activeDatabase=data;refreshManifest(data);
 if(state.mapId&&!mapIndex.has(state.mapId))state.mapId=null;
 state.candidates=state.candidates.filter(id=>mapIndex.has(id));
 saveSettings();if(win&&!win.isDestroyed())win.webContents.reload();
 broadcastDatabase(`地圖已更新 · ${manifest.maps.length} 張`);
}
async function checkDatabase(){
 if(!database)return;
 try{const result=await database.check(broadcastDatabase);if(!result.changed&&pendingDatabase){broadcastDatabase('地圖下載完成，關閉辨識視窗後套用');return;}if(result.changed&&result.data.version!==activeDatabase.version){if(workWin&&!workWin.isDestroyed()){pendingDatabase=result.data;broadcastDatabase('地圖下載完成，關閉辨識視窗後套用');}else activateDatabase(result.data);}else broadcastDatabase(`地圖已是最新 · ${manifest.maps.length} 張`);}
 catch(_){broadcastDatabase(`未能連線更新，沿用目前 ${manifest.maps.length} 張地圖`);}
}
ipcMain.handle('get-database',event=>{if(event.sender!==win?.webContents&&event.sender!==workWin?.webContents)throw Error('來源無效');return {...activeDatabase,status:databaseStatus};});
ipcMain.handle('check-database',async event=>{if(event.sender!==win?.webContents&&event.sender!==workWin?.webContents)return;await checkDatabase();return databaseStatus;});

ipcMain.on('matcher-minimize',event=>{if(event.sender===workWin?.webContents)workWin.minimize();});
ipcMain.on('matcher-close',event=>{if(event.sender===workWin?.webContents)workWin.close();});
