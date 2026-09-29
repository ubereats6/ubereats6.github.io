const image = document.getElementById('map');
const empty = document.getElementById('empty');
const title = document.getElementById('title');
const candidateStrip = document.getElementById('candidates');
const opacity = document.getElementById('opacity');
const opacityValue = document.getElementById('opacityValue');
const tip = document.getElementById('lockTip');
let currentMap = null;
let locked = false;
let tipTimer;

function showMap(id) {
  if (!Number.isInteger(id) || id < 1 || id > 9999) return;
  if (currentMap === id) return;
  currentMap = id;
  title.textContent = `搶蛋地圖輔助 · ${id}`;
  image.classList.remove('ready');
  empty.style.display = 'block';
  empty.textContent = `正在載入地圖 ${id}…`;
  image.src = `https://ubereats6.github.io/egg-map/maps/${id}.jpg`;
}
image.addEventListener('load', () => {
  image.classList.add('ready');
  empty.style.display = 'none';
});
image.addEventListener('error', () => {
  image.classList.remove('ready');
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
