const mapContent=document.getElementById('mapContent');
const markerOverlay=document.getElementById('markerOverlay');
let mapIndex=new Map(),layerIndex=new Map(),pendingState;
const markerVisibility={main:true,side:true,challenge:true,chest:true,key:true};
const image = document.getElementById('map');
const mapArea = document.getElementById('mapArea');
const mapZoom = document.getElementById('mapZoom');
const zoomLevel = document.getElementById('zoomLevel');
const empty = document.getElementById('empty');
const title = document.getElementById('title');
const candidateStrip = document.getElementById('candidates');
const opacity = document.getElementById('opacity');
const opacityValue = document.getElementById('opacityValue');
const tip = document.getElementById('lockTip');
let currentMap = null;
let locked = false;
let tipTimer;
let zoom = 100;
let pan = {x:0,y:0};
let panStart = null;

function clampPan() {
  if (!image.naturalWidth || !image.naturalHeight) return;
  const width = mapArea.clientWidth, height = mapArea.clientHeight;
  const fit = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  // A little travel at low zoom makes panning useful even when one axis still fits.
  const travel = zoom > 100 ? Math.min(width,height) * .18 : 0;
  const maxX = Math.max(0, (image.naturalWidth * fit * zoom / 100 - width) / 2) + travel;
  const maxY = Math.max(0, (image.naturalHeight * fit * zoom / 100 - height) / 2) + travel;
  pan.x = Math.max(-maxX, Math.min(maxX, pan.x));
  pan.y = Math.max(-maxY, Math.min(maxY, pan.y));
  mapArea.classList.toggle('can-pan', zoom > 100);
}
function renderZoom() {
  clampPan();
  if(image.naturalWidth){
    const fit=Math.min(mapArea.clientWidth/image.naturalWidth,mapArea.clientHeight/image.naturalHeight);
    mapContent.style.width=`${image.naturalWidth*fit}px`;mapContent.style.height=`${image.naturalHeight*fit}px`;
  }
  mapContent.style.transform=`translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom / 100})`;
  zoomLevel.value = `${zoom}%`;
  document.getElementById('zoomOut').disabled = zoom === 50;
  document.getElementById('zoomIn').disabled = zoom === 400;
}
function setZoom(next) {
  zoom = Math.max(50, Math.min(400, next));
  renderZoom();
}
document.getElementById('zoomOut').addEventListener('click', () => setZoom(zoom - 25));
document.getElementById('zoomIn').addEventListener('click', () => setZoom(zoom + 25));
document.getElementById('zoomReset').addEventListener('click', () => { zoom = 100; pan = {x:0,y:0}; renderZoom(); });
mapArea.addEventListener('wheel', event => {
  if (locked || !image.classList.contains('ready')) return;
  event.preventDefault();
  setZoom(zoom + (event.deltaY < 0 ? 25 : -25));
}, {passive:false});
mapArea.addEventListener('mousedown', event => {
  if (locked || event.button !== 0 || !mapArea.classList.contains('can-pan') || event.target.closest('.map-zoom')) return;
  event.preventDefault();
  panStart = {x:event.clientX,y:event.clientY,panX:pan.x,panY:pan.y};
  mapArea.classList.add('panning');
});
window.addEventListener('mousemove', event => {
  if (!panStart) return;
  pan.x = panStart.panX + event.clientX - panStart.x;
  pan.y = panStart.panY + event.clientY - panStart.y;
  renderZoom();
});
function endPan() { panStart = null; mapArea.classList.remove('panning'); }
window.addEventListener('mouseup', endPan);
window.addEventListener('blur', endPan);
window.addEventListener('resize', renderZoom);

function showMap(id) {
  if (!mapIndex.has(id)) return;
  if (currentMap === id) return;
  currentMap = id;
  zoom = 100;
  pan = {x:0,y:0};
  renderZoom();
  mapZoom.hidden = true;
  title.textContent = `搶蛋地圖輔助 · ${mapIndex.get(id).difficultyLabel} · 地圖 ${id}`;title.title=title.textContent;image.alt=title.textContent;
  image.classList.remove('ready');
  empty.style.display = 'block';
  empty.textContent = `正在載入地圖 ${id}…`;
  renderMarkers(id);image.src=mapIndex.get(id).cleanImage;
}
image.addEventListener('load', () => {
  image.classList.add('ready');
  empty.style.display = 'none';
  mapZoom.hidden = false;
  renderZoom();
});
image.addEventListener('error', () => {
  image.classList.remove('ready');
  mapZoom.hidden = true;
  empty.style.display = 'block';
  empty.textContent = `地圖 ${currentMap} 無法載入，請完整解壓縮下載包後再執行。`;
});
function showTip() {
  clearTimeout(tipTimer);
  tip.classList.add('show');
  tipTimer = setTimeout(() => tip.classList.remove('show'), 6000);
}
function applyState(state) {
  if(!mapIndex.size){pendingState=state;return;}
  showMap(state.mapId);
  const ids=Array.isArray(state.candidates)?state.candidates:[];
  candidateStrip.replaceChildren();
  candidateStrip.hidden=!ids.length;
  ids.forEach((id,index)=>{
    const button=document.createElement('button');button.type='button';
    const thumb=document.createElement('img');thumb.src=mapIndex.get(id).image;thumb.alt='';
    const label=document.createElement('span');label.textContent=`${index+1} · 地圖 ${id}`;button.append(thumb,label);
    button.classList.toggle('selected',id===state.mapId);
    button.setAttribute('aria-pressed',String(id===state.mapId));
    button.addEventListener('click',()=>window.mapHud.selectCandidate(id));
    candidateStrip.append(button);
  });
  opacity.value = String(Math.round(state.opacity * 100));
  opacityValue.value = `${opacity.value}%`;
  const changed = locked !== state.locked;
  locked = state.locked;
  document.body.classList.toggle('locked', locked);
  if (locked && changed) showTip();
  if (!locked) { clearTimeout(tipTimer); tip.classList.remove('show'); }
  requestAnimationFrame(renderZoom);
}
window.mapHud.onState(applyState);
opacity.addEventListener('input', () => {
  opacityValue.value = `${opacity.value}%`;
  window.mapHud.setOpacity(Number(opacity.value) / 100);
});
document.getElementById('lock').addEventListener('click', () => window.mapHud.setLocked(true));
document.getElementById('match').addEventListener('click', () => window.mapHud.openMatcher());
document.getElementById('hide').addEventListener('click', () => window.mapHud.hide());
const grip = document.getElementById('resizeGrip');
let lastPoint = null;
grip.addEventListener('pointerdown', event => {
  lastPoint = {x:event.screenX,y:event.screenY};
  grip.setPointerCapture(event.pointerId);
});
grip.addEventListener('pointermove', event => {
  if (!lastPoint) return;
  const next={x:event.screenX,y:event.screenY};
  window.mapHud.resizeBy({x:next.x-lastPoint.x,y:next.y-lastPoint.y});
  lastPoint=next;
});
grip.addEventListener('pointerup', () => { lastPoint=null; });
grip.addEventListener('pointercancel', () => { lastPoint=null; });

function renderMarkers(id){
 markerOverlay.replaceChildren();const layer=layerIndex.get(id);if(!layer)return;
 markerOverlay.setAttribute('viewBox',`0 0 ${layer.width} ${layer.height}`);
 for(const group of layer.groups){
  if(group.type!=='egg'&&markerVisibility[group.type]===false)continue;
  const g=document.createElementNS('http://www.w3.org/2000/svg','g');
  for(const item of group.elements){
   if(!['image','title','path','rect','text'].includes(item.tag))continue;
   const e=document.createElementNS('http://www.w3.org/2000/svg',item.tag);
   for(const [key,value] of Object.entries(item.attrs||{})){
    if(/^on/i.test(key)||key==='style')continue;
    if(key==='href'&&!/^marker-icons\/[a-z]+-[a-f0-9]+\.webp$/.test(value))continue;
    e.setAttribute(key,key==='href'?new URL(value,databaseAssets).href:value);
   }
   e.textContent=item.text||'';g.append(e);
  }
  markerOverlay.append(g);
 }
}
for(const input of document.querySelectorAll('[data-marker-toggle]'))input.addEventListener('change',()=>{markerVisibility[input.dataset.markerToggle]=input.checked;renderMarkers(currentMap);});
let databaseAssets='';
window.mapHud.onDatabaseStatus(text=>{document.getElementById('databaseStatus').textContent=text;});
document.getElementById('databaseCheck').addEventListener('click',async()=>{const button=document.getElementById('databaseCheck');button.disabled=true;try{await window.mapHud.checkDatabase();}finally{button.disabled=false;}});
window.mapHud.getDatabase().then(data=>{
 databaseAssets=data.assetBase;document.getElementById('databaseStatus').textContent=data.status;
 mapIndex=new Map(data.manifest.maps.map(m=>[m.id,m]));layerIndex=new Map(data.layers.maps.map(m=>[m.id,m]));if(pendingState)applyState(pendingState);
}).catch(()=>{empty.textContent='地圖資料無法載入，請完整解壓縮下載包。';});
