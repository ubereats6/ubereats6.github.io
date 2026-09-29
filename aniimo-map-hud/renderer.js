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
  const maxX = Math.max(0, (image.naturalWidth * fit * zoom / 100 - width) / 2);
  const maxY = Math.max(0, (image.naturalHeight * fit * zoom / 100 - height) / 2);
  pan.x = Math.max(-maxX, Math.min(maxX, pan.x));
  pan.y = Math.max(-maxY, Math.min(maxY, pan.y));
  mapArea.classList.toggle('can-pan', maxX > 0 || maxY > 0);
}
function renderZoom() {
  clampPan();
  image.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom / 100})`;
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
mapArea.addEventListener('pointerdown', event => {
  if (locked || event.button !== 0 || !mapArea.classList.contains('can-pan') || event.target.closest('.map-zoom')) return;
  panStart = {x:event.clientX,y:event.clientY,panX:pan.x,panY:pan.y};
  mapArea.setPointerCapture(event.pointerId);
  mapArea.classList.add('panning');
});
mapArea.addEventListener('pointermove', event => {
  if (!panStart) return;
  pan.x = panStart.panX + event.clientX - panStart.x;
  pan.y = panStart.panY + event.clientY - panStart.y;
  renderZoom();
});
function endPan() { panStart = null; mapArea.classList.remove('panning'); }
mapArea.addEventListener('pointerup', endPan);
mapArea.addEventListener('pointercancel', endPan);
window.addEventListener('resize', renderZoom);

function showMap(id) {
  if (!Number.isInteger(id) || id < 1 || id > 9999) return;
  if (currentMap === id) return;
  currentMap = id;
  zoom = 100;
  pan = {x:0,y:0};
  renderZoom();
  mapZoom.hidden = true;
  title.textContent = `搶蛋地圖輔助 · ${id}`;
  image.classList.remove('ready');
  empty.style.display = 'block';
  empty.textContent = `正在載入地圖 ${id}…`;
  image.src = `https://ubereats6.github.io/egg-map/maps/${id}.jpg`;
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
  empty.textContent = `地圖 ${currentMap} 尚未上傳或無法連線。請確認網頁能開啟此地圖。`;
});
function showTip() {
  clearTimeout(tipTimer);
  tip.classList.add('show');
  tipTimer = setTimeout(() => tip.classList.remove('show'), 6000);
}
window.mapHud.onState(state => {
  showMap(state.mapId);
  const ids=Array.isArray(state.candidates)?state.candidates:[];
  candidateStrip.replaceChildren();
  candidateStrip.hidden=!ids.length;
  ids.forEach((id,index)=>{
    const button=document.createElement('button');button.type='button';
    button.textContent=`${index+1} · 地圖 ${id}`;
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
});
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
