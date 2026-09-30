(() => {
  const upload = document.getElementById('mapUpload');
  const name = document.getElementById('fileName');
  const area = document.getElementById('cropArea');
  const canvas = document.getElementById('mapPreview');
  const ctx = canvas.getContext('2d');
  const status = document.getElementById('matchStatus');
  const results = document.getElementById('matchResults');
  const viewer = document.getElementById('mapViewer');
  const viewerTitle = document.getElementById('viewerTitle');
  const viewerImage = document.getElementById('viewerImage');
  const hudLink = document.getElementById('openMapHud');
  const mapCanvas = document.getElementById('mapCanvas');
  const zoomLevel = document.getElementById('zoomLevel');
  const analyze = document.getElementById('analyzeMap');
  const reset = document.getElementById('resetCrop');
  const captureButton = document.getElementById('captureWindow');
  const captureSelection = document.getElementById('captureSelection');
  const captureSelectCanvas = document.getElementById('captureSelectCanvas');
  const captureContext = captureSelectCanvas.getContext('2d');
  const worker = new Worker('matcher-worker.js?v=13');
  let zoom = 50;
  function setZoom(next, anchor = null) {
    const before = anchor ? mapCanvas.getBoundingClientRect() : null;
    const point = before && before.width && before.height ? {
      x: (anchor.x - before.left) / before.width,
      y: (anchor.y - before.top) / before.height
    } : null;
    zoom = Math.max(25, Math.min(300, next));
    mapCanvas.style.width = `${zoom}%`;
    zoomLevel.value = `${Math.round(zoom)}%`;
    document.getElementById('zoomOut').disabled = zoom === 25;
    document.getElementById('zoomIn').disabled = zoom === 300;
    if (point) {
      const after = mapCanvas.getBoundingClientRect();
      // Keep the map location beneath the cursor still as its size changes.
      mapViewport.scrollLeft += after.left + point.x * after.width - anchor.x;
      mapViewport.scrollTop += after.top + point.y * after.height - anchor.y;
    }
  }
  document.getElementById('zoomOut').addEventListener('click', () => setZoom(zoom - 25));
  document.getElementById('zoomIn').addEventListener('click', () => setZoom(zoom + 25));
  setZoom(50);
  let maps = [], difficulty = '', requestId = 0, matching = false, capturing = false;
  let selectedMap = null, markerLayers = new Map();
  const markerOverlay = document.getElementById('markerOverlay');
  const markerStatus = document.getElementById('markerStatus');
  const markerControls = [...document.querySelectorAll('[data-marker-toggle]')];
  const markerVisibility = {main:true, side:true, challenge:true, chest:true, key:true};
  function updateMarkerVisibility() {
    for (const group of markerOverlay.querySelectorAll('[data-marker-type]')) {
      group.style.display = group.dataset.markerType === 'egg' || markerVisibility[group.dataset.markerType] ? '' : 'none';
    }
  }
  for (const control of markerControls) control.addEventListener('change', () => {
    markerVisibility[control.dataset.markerToggle] = control.checked;
    updateMarkerVisibility();
  });
  function renderMapLayers(map) {
    const layers = markerLayers.get(map.id);
    markerOverlay.replaceChildren();
    for (const control of markerControls) control.disabled = !layers;
    viewerImage.src = layers ? map.cleanImage : map.image;
    if (!layers) {
      markerStatus.textContent = '標記圖層尚未載入，目前顯示完整地圖。';
      return;
    }
    markerStatus.textContent = '蛋固定顯示；勾選其他標記即可開啟或關閉。';
    markerOverlay.setAttribute('viewBox', `0 0 ${layers.width} ${layers.height}`);
    const svgNS = 'http://www.w3.org/2000/svg';
    for (const layer of layers.groups) {
      const group = document.createElementNS(svgNS, 'g');
      group.dataset.markerType = layer.type;
      for (const item of layer.elements) {
        if (!['image','title','path','rect','text'].includes(item.tag)) continue;
        const element = document.createElementNS(svgNS, item.tag);
        for (const [key,value] of Object.entries(item.attrs)) {
          if (key.startsWith('on') || key === 'style') continue;
          if (key === 'href' && !/^marker-icons\/[a-z]+-[a-f0-9]+\.webp$/.test(value)) continue;
          element.setAttribute(key,value);
        }
        if (item.text) element.textContent = item.text;
        group.append(element);
      }
      markerOverlay.append(group);
    }
    updateMarkerVisibility();
  }
  async function loadMarkerLayers() {
    try {
      const response = await fetch('marker-layers.json?v=15');
      if (!response.ok) throw new Error('標記資料載入失敗');
      const data = await response.json();
      if (!Array.isArray(data.maps) || data.maps.length !== 30) throw new Error('標記資料不完整');
      markerLayers = new Map(data.maps.map(map => [map.id,map]));
      if (selectedMap && !viewer.hidden) renderMapLayers(selectedMap);
    } catch (_) {
      markerStatus.textContent = '標記圖層載入失敗，完整地圖仍可查看。';
    }
  }

  const radios = [...document.querySelectorAll('input[name="difficulty"]')];
  const gallery = document.getElementById('mapGallery');
  const galleryStatus = document.getElementById('galleryStatus');
  const galleryCount = document.getElementById('galleryCount');
  const supportsCapture = Boolean(navigator.mediaDevices?.getDisplayMedia);
  function syncControls() {
    const ready = Boolean(difficulty && maps.length);
    upload.disabled = !ready || capturing;
    captureButton.disabled = !ready || capturing || !supportsCapture;
    analyze.disabled = !ready || !image || matching || capturing;
    document.querySelector('.egg-pick').classList.toggle('is-disabled', upload.disabled);
    for (const radio of radios) radio.disabled = capturing;
    if (difficulty) {
      const label = radios.find(radio => radio.value === difficulty).nextElementSibling.firstChild.textContent;
      const count = maps.filter(map => map.difficulty === difficulty).length;
      document.getElementById('difficultyHint').textContent = ready
        ? `已選擇${label}，只比對此難度的 ${count} 張地圖。`
        : '地圖資料尚未載入，請稍候或重新載入。';
    }
  }
  function clearMatch() {
    requestId++; matching = false; selectedMap = null;
    results.replaceChildren(); viewer.hidden = true; hudLink.hidden = true;
    viewerImage.removeAttribute('src');
    for (const card of gallery.querySelectorAll('.is-selected')) {
      card.classList.remove('is-selected'); card.setAttribute('aria-pressed', 'false');
    }
    syncControls();
  }
  function showMap(id, selectedCard) {
    const map = maps.find(item => item.id === id);
    if (!map) { setStatus('這張地圖無法載入，請重新整理再試。'); return; }
    for (const card of document.querySelectorAll('.egg-result, .egg-gallery-card')) {
      const selected = card === selectedCard;
      card.classList.toggle('is-selected', selected);
      card.setAttribute('aria-pressed', String(selected));
    }
    viewerTitle.textContent = `${map.difficultyLabel} · ${map.name}`;
    selectedMap = map; renderMapLayers(map);
    viewerImage.alt = `${map.difficultyLabel} ${map.name} 的完整標記地圖`;
    // The released HUD still has the old map pool; do not send it new IDs.
    hudLink.hidden = true; hudLink.removeAttribute('href');
    setZoom(50); viewer.hidden = false;
    document.querySelector('.egg-full-map').scrollTo(0, 0);
    viewer.scrollIntoView({behavior:'smooth', block:'start'});
  }
  function renderGallery(filter = 'all') {
    const shown = maps.filter(map => filter === 'all' || map.difficulty === filter);
    galleryCount.textContent = `${shown.length} 張地圖`;
    gallery.replaceChildren(...shown.map(map => {
      const card = document.createElement('button');
      card.type = 'button'; card.className = 'egg-gallery-card';
      card.setAttribute('aria-pressed', 'false');
      const thumb = document.createElement('img');
      thumb.src = map.image; thumb.alt = `${map.name} 縮圖`;
      thumb.loading = 'lazy'; thumb.decoding = 'async';
      thumb.width = map.width; thumb.height = map.height;
      const copy = document.createElement('span'); copy.className = 'egg-gallery-copy';
      const title = document.createElement('strong'); title.textContent = map.name;
      const badge = document.createElement('small'); badge.textContent = map.difficultyLabel;
      const action = document.createElement('span'); action.className = 'egg-gallery-open'; action.textContent = '查看地圖 ↗';
      copy.append(title, badge); card.append(thumb, copy, action);
      card.addEventListener('click', () => showMap(map.id, card));
      return card;
    }));
    galleryStatus.textContent = '';
  }
  document.getElementById('galleryFilters').addEventListener('click', event => {
    const button = event.target.closest('button[data-difficulty]'); if (!button) return;
    for (const item of document.querySelectorAll('#galleryFilters button')) item.setAttribute('aria-pressed', String(item === button));
    renderGallery(button.dataset.difficulty);
  });
  for (const radio of radios) radio.addEventListener('change', () => {
    difficulty = radio.value; clearMatch();
    setStatus(image ? '難度已切換，請重新開始比對。' : '可以擷取地圖畫面或選擇截圖。');
  });
  async function loadMaps() {
    try {
      const response = await fetch('maps.json?v=13');
      if (!response.ok) throw new Error('地圖資料載入失敗');
      const data = await response.json(); maps = data.maps;
      if (!Array.isArray(maps) || maps.length !== 30) throw new Error('地圖資料不完整');
      renderGallery(document.querySelector('#galleryFilters [aria-pressed="true"]').dataset.difficulty);
      syncControls();
    } catch (error) {
      maps = []; syncControls(); galleryStatus.replaceChildren();
      const message = document.createElement('span'); message.textContent = '地圖資料載入失敗，請重試。 ';
      const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = '重新載入';
      retry.addEventListener('click', loadMaps); galleryStatus.append(message, retry);
      setStatus('地圖資料尚未載入，暫時無法比對。');
    }
  }
  viewerImage.addEventListener('error', () => { viewerImage.alt = '地圖圖片載入失敗，請重新選擇或整理頁面。'; });
  const mapViewport = document.querySelector('.egg-full-map');
  mapViewport.addEventListener('wheel', event => {
    if (viewer.hidden || !viewerImage.getAttribute('src') || event.ctrlKey || event.metaKey || !event.deltaY) return;
    const bounds = mapCanvas.getBoundingClientRect();
    if (!bounds.width || !bounds.height || event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? mapViewport.clientHeight : 1;
    const delta = Math.max(-120, Math.min(120, event.deltaY * unit));
    setZoom(zoom * Math.exp(-delta * .002), {x:event.clientX, y:event.clientY});
    // Dragging continues from the new scroll position if zoom occurs mid-drag.
    if (pan) pan = {x:event.clientX, y:event.clientY, left:mapViewport.scrollLeft, top:mapViewport.scrollTop};
  }, {passive:false});
  let pan = null;
  mapViewport.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'mouse' || event.button !== 0) return;
    pan = {x:event.clientX, y:event.clientY, left:mapViewport.scrollLeft, top:mapViewport.scrollTop};
    mapViewport.setPointerCapture(event.pointerId); mapViewport.classList.add('is-dragging'); event.preventDefault();
  });
  mapViewport.addEventListener('pointermove', event => {
    if (!pan) return;
    mapViewport.scrollLeft = pan.left - (event.clientX - pan.x);
    mapViewport.scrollTop = pan.top - (event.clientY - pan.y);
  });
  for (const type of ['pointerup','pointercancel','lostpointercapture']) mapViewport.addEventListener(type, () => { pan = null; mapViewport.classList.remove('is-dragging'); });
  viewerImage.draggable = false;
  let image = null, imageUrl = null, crop = null, start = null;
  let selectStart = null, selectRect = null, previousOverflow = '';
  const setStatus = message => { status.textContent = message; };

  function draw() {
    if (!image) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    if (!crop) return;
    ctx.fillStyle = 'rgba(2,8,20,.45)';
    ctx.fillRect(0, 0, canvas.width, crop.y);
    ctx.fillRect(0, crop.y, crop.x, crop.h);
    ctx.fillRect(crop.x + crop.w, crop.y, canvas.width - crop.x - crop.w, crop.h);
    ctx.fillRect(0, crop.y + crop.h, canvas.width, canvas.height - crop.y - crop.h);
    ctx.strokeStyle = '#69d9ff'; ctx.lineWidth = 3;
    ctx.strokeRect(crop.x + 1, crop.y + 1, Math.max(0,crop.w - 2), Math.max(0,crop.h - 2));
  }
  function point(event) {
    const rect = canvas.getBoundingClientRect();
    return {x:Math.max(0,Math.min(canvas.width,Math.round((event.clientX-rect.left)*canvas.width/rect.width))),
      y:Math.max(0,Math.min(canvas.height,Math.round((event.clientY-rect.top)*canvas.height/rect.height)))};
  }
  canvas.addEventListener('pointerdown', event => {
    if (!image) return;
    start = point(event); canvas.setPointerCapture(event.pointerId);
    crop = {x:start.x,y:start.y,w:0,h:0}; draw();
  });
  canvas.addEventListener('pointermove', event => {
    if (!start) return;
    const end = point(event);
    crop = {x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),w:Math.abs(start.x-end.x),h:Math.abs(start.y-end.y)};
    draw();
  });
  canvas.addEventListener('pointerup', event => {
    if (!start) return;
    const end = point(event);
    crop = {x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),w:Math.abs(start.x-end.x),h:Math.abs(start.y-end.y)};
    start = null;
    if (crop.w < 25 || crop.h < 25) crop = {x:0,y:0,w:canvas.width,h:canvas.height};
    draw();
    setStatus('已選取地圖範圍，可以開始比對。');
  });
  canvas.addEventListener('pointercancel', () => { start=null; crop={x:0,y:0,w:canvas.width,h:canvas.height}; draw(); });
  reset.addEventListener('click', () => {
    crop = {x:0,y:0,w:canvas.width,h:canvas.height}; draw();
    setStatus('已重設為整張截圖。');
  });
  function showImage(next, url, label) {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    imageUrl=url; image=next;
    const scale=Math.min(1,850/next.naturalWidth,650/next.naturalHeight);
    canvas.width=Math.max(1,Math.round(next.naturalWidth*scale));
    canvas.height=Math.max(1,Math.round(next.naturalHeight*scale));
    crop={x:0,y:0,w:canvas.width,h:canvas.height};
    area.hidden=false; name.textContent=label;
    clearMatch(); draw();
  }
  function drawCaptureSelection() {
    if (!image) return;
    const w=captureSelectCanvas.width, h=captureSelectCanvas.height;
    captureContext.clearRect(0,0,w,h);
    captureContext.drawImage(image,0,0,w,h);
    if (!selectRect) return;
    const {x,y,w:width,h:height}=selectRect;
    captureContext.fillStyle='rgba(2,8,20,.53)';
    captureContext.fillRect(0,0,w,y);
    captureContext.fillRect(0,y,x,height);
    captureContext.fillRect(x+width,y,w-x-width,height);
    captureContext.fillRect(0,y+height,w,h-y-height);
    captureContext.strokeStyle='#71ddff'; captureContext.lineWidth=3;
    captureContext.strokeRect(x+1,y+1,Math.max(0,width-2),Math.max(0,height-2));
  }
  function selectPoint(event) {
    const bounds=captureSelectCanvas.getBoundingClientRect();
    return {x:Math.max(0,Math.min(captureSelectCanvas.width,Math.round((event.clientX-bounds.left)*captureSelectCanvas.width/bounds.width))),
      y:Math.max(0,Math.min(captureSelectCanvas.height,Math.round((event.clientY-bounds.top)*captureSelectCanvas.height/bounds.height)))};
  }
  function openCaptureSelection() {
    selectRect=null; selectStart=null;
    const scale=Math.min(1,Math.max(240,window.innerWidth-56)/image.naturalWidth,
      Math.max(240,window.innerHeight-220)/image.naturalHeight);
    captureSelectCanvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
    captureSelectCanvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
    previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    captureSelection.hidden=false;
    drawCaptureSelection();
    window.focus();
    document.getElementById('captureCancel').focus();
  }
  function closeCaptureSelection() {
    captureSelection.hidden=true;
    document.body.style.overflow=previousOverflow;
    selectStart=null; selectRect=null;
  }
  function completeCaptureSelection(whole=false) {
    if (!whole && (!selectRect || selectRect.w<20 || selectRect.h<20)) return;
    const rect=whole ? {x:0,y:0,w:captureSelectCanvas.width,h:captureSelectCanvas.height} : selectRect;
    crop={x:Math.round(rect.x*canvas.width/captureSelectCanvas.width),
      y:Math.round(rect.y*canvas.height/captureSelectCanvas.height),
      w:Math.max(1,Math.round(rect.w*canvas.width/captureSelectCanvas.width)),
      h:Math.max(1,Math.round(rect.h*canvas.height/captureSelectCanvas.height))};
    closeCaptureSelection();
    draw();
    startMatching();
  }
  captureSelectCanvas.addEventListener('pointerdown', event => {
    selectStart=selectPoint(event);
    captureSelectCanvas.setPointerCapture(event.pointerId);
    selectRect={x:selectStart.x,y:selectStart.y,w:0,h:0};
    drawCaptureSelection();
  });
  captureSelectCanvas.addEventListener('pointermove', event => {
    if (!selectStart) return;
    const end=selectPoint(event);
    selectRect={x:Math.min(selectStart.x,end.x),y:Math.min(selectStart.y,end.y),
      w:Math.abs(selectStart.x-end.x),h:Math.abs(selectStart.y-end.y)};
    drawCaptureSelection();
  });
  captureSelectCanvas.addEventListener('pointerup', event => {
    if (!selectStart) return;
    const end=selectPoint(event);
    selectRect={x:Math.min(selectStart.x,end.x),y:Math.min(selectStart.y,end.y),
      w:Math.abs(selectStart.x-end.x),h:Math.abs(selectStart.y-end.y)};
    selectStart=null;
    completeCaptureSelection();
  });
  captureSelectCanvas.addEventListener('pointercancel', () => { selectStart=null; selectRect=null; drawCaptureSelection(); });
  document.getElementById('captureFull').addEventListener('click', () => completeCaptureSelection(true));
  document.getElementById('captureCancel').addEventListener('click', () => { closeCaptureSelection(); setStatus('已取消框選；可以在下方預覽中選取地圖。'); });
  document.addEventListener('keydown', event => {
    if (event.key==='Escape' && !captureSelection.hidden) {
      closeCaptureSelection(); setStatus('已取消框選；可以在下方預覽中選取地圖。');
    }
  });
  upload.addEventListener('change', () => {
    if (!difficulty || !maps.length) { setStatus('請先選擇難度。'); return; }
    const file = upload.files?.[0]; if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 20*1024*1024) {
      setStatus('請選擇 20 MB 以下的 PNG、JPG 或 WebP 圖片。'); return;
    }
    const url = URL.createObjectURL(file);
    const next = new Image();
    next.onload = () => {
      showImage(next,url,file.name);
      setStatus('請框選地圖區域，再開始比對。');
    };
    next.onerror=()=>{URL.revokeObjectURL(url);setStatus('圖片讀取失敗，請換一張截圖。');};
    next.src=url;
  });
  if (!navigator.mediaDevices?.getDisplayMedia) {
    captureButton.disabled=true;
    captureButton.title='此瀏覽器不支援視窗擷取；請改用選擇截圖。';
  }
  function withTimeout(promise, milliseconds) {
    let timer;
    return Promise.race([
      promise,
      new Promise((_, reject) => { timer=setTimeout(() => reject(new Error('擷取畫面逾時，請重試。')), milliseconds); }),
    ]).finally(() => clearTimeout(timer));
  }
  captureButton.addEventListener('click', async () => {
    if (!supportsCapture || !difficulty || !maps.length) return;
    capturing=true; syncControls();
    setStatus('請在瀏覽器視窗中選擇正在顯示地圖的遊戲視窗。');
    let stream, video;
    try {
      // The browser chooser is opened directly by the user's click.
      const options={video:true,audio:false};
      const controller=typeof CaptureController==='function' ? new CaptureController() : null;
      if (controller) options.controller=controller;
      stream = await navigator.mediaDevices.getDisplayMedia(options);
      // Supported browsers can keep this page visible after the user picks a game window.
      if (controller && stream.getVideoTracks()[0]?.getSettings?.().displaySurface !== 'monitor') {
        try { controller.setFocusBehavior('no-focus-change'); } catch (_) { /* Browser handles focus. */ }
      }
      video = document.createElement('video');
      video.muted=true; video.playsInline=true; video.srcObject=stream;
      await withTimeout(video.play(),8000);
      await withTimeout(new Promise(resolve => {
        if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(resolve);
        else setTimeout(resolve,200);
      }),8000);
      if (!video.videoWidth || !video.videoHeight) throw new Error('無法讀取選取視窗的畫面。');
      const shot=document.createElement('canvas');
      const scale=Math.min(1,1920/video.videoWidth,1200/video.videoHeight);
      shot.width=Math.max(1,Math.round(video.videoWidth*scale));
      shot.height=Math.max(1,Math.round(video.videoHeight*scale));
      shot.getContext('2d').drawImage(video,0,0,shot.width,shot.height);
      // The stream is no longer needed after this single frame.
      stream.getTracks().forEach(track => track.stop());
      video.srcObject=null;
      const blob=await new Promise(resolve => shot.toBlob(resolve,'image/png'));
      if (!blob) throw new Error('畫面擷取失敗，請改用上傳截圖。');
      const url=URL.createObjectURL(blob);
      const next=new Image();
      await new Promise((resolve,reject) => {
        next.onload=()=>{showImage(next,url,'剛擷取的地圖畫面');resolve();};
        next.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('擷取圖片讀取失敗。'));};
        next.src=url;
      });
      setStatus('已擷取單張畫面；請在擷取畫面上框選地圖，放開後會自動比對。');
      openCaptureSelection();
    } catch (error) {
      if (error.name === 'NotAllowedError' || error.name === 'AbortError')
        setStatus('已取消擷取。你仍可上傳截圖。');
      else setStatus(error.message || '擷取失敗，請改用上傳截圖。');
    } finally {
      stream?.getTracks().forEach(track => track.stop());
      if (video) video.srcObject=null;
      capturing=false; syncControls();
    }
  });
  function getMask() {
    const target=document.createElement('canvas');
    const scale=116/Math.max(crop.w,crop.h);
    target.width=Math.max(1,Math.round(crop.w*scale));
    target.height=Math.max(1,Math.round(crop.h*scale));
    const c=target.getContext('2d',{willReadFrequently:true});
    c.drawImage(image,crop.x*image.naturalWidth/canvas.width,crop.y*image.naturalHeight/canvas.height,
      crop.w*image.naturalWidth/canvas.width,crop.h*image.naturalHeight/canvas.height,0,0,target.width,target.height);
    const pixels=c.getImageData(0,0,target.width,target.height).data;
    const mask=new Uint8Array(target.width*target.height);
    let left=target.width,top=target.height,right=-1,bottom=-1,count=0;
    for(let y=0;y<target.height;y++) for(let x=0;x<target.width;x++){
      const i=y*target.width+x,p=i*4;
      const brightness=(pixels[p]+pixels[p+1]+pixels[p+2])/3;
      if(brightness>55&&brightness<228){mask[i]=1;count++;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    }
    if(count<60||count/mask.length>.84) throw new Error('框選區域缺少清楚的地圖路徑，請縮小範圍並避開其他介面。');
    left=Math.max(0,left-1);top=Math.max(0,top-1);
    right=Math.min(target.width-1,right+1);bottom=Math.min(target.height-1,bottom+1);
    const w=right-left+1,h=bottom-top+1,out=new Uint8Array(w*h);
    for(let y=0;y<h;y++) for(let x=0;x<w;x++) out[y*w+x]=mask[(y+top)*target.width+x+left];
    return {w,h,pixels:out};
  }
  function startMatching() {
    if (!difficulty) { setStatus('請先選擇搶蛋地圖難度。'); return; }
    if (!image || !maps.length || matching) return;
    try {
      const mask=getMask();
      requestId++; matching=true; syncControls();
      analyze.disabled=true;results.replaceChildren();viewer.hidden=true;hudLink.hidden=true;viewerImage.removeAttribute('src');
      setStatus('正在比對地圖輪廓，可能需要幾秒鐘…');
      worker.postMessage({type:'match',difficulty,requestId,...mask});
    } catch(error){matching=false;syncControls();setStatus(error.message);}
  }
  analyze.addEventListener('click', startMatching);
  worker.onmessage=({data})=>{
    if (data.requestId !== requestId || data.difficulty !== difficulty) return;
    matching=false; syncControls();
    if(data.type==='error'){setStatus(data.message);return;}
    if(!data.results.length){setStatus('沒有足夠的地圖線索，請換一張截圖。');return;}
    const cards=data.results.map((item,index)=>{
      const card=document.createElement('button');card.type='button';card.className='egg-result';
      card.setAttribute('aria-pressed','false');
      const rank=document.createElement('small');rank.textContent=`候選 ${index+1}`;
      const title=document.createElement('strong');title.textContent=`地圖 ${item.id}`;
      const score=document.createElement('span');score.textContent=`輪廓分數 ${Math.min(100,Math.max(0,Math.round(item.score*100)))}`;
      card.append(rank,title,score);
      card.addEventListener('click',()=>showMap(item.id,card));
      return card;
    });
    results.replaceChildren(...cards);
    setStatus('這是輪廓比對的候選排序，不代表已確定是哪張地圖。');
    results.scrollIntoView({behavior:'smooth',block:'start'});
  };
  document.getElementById('closeViewer').addEventListener('click',()=>{selectedMap=null;viewer.hidden=true;hudLink.hidden=true;viewerImage.removeAttribute('src');});
  worker.onerror=()=>{matching=false;syncControls();setStatus('辨識程式暫時無法執行，請重新整理後再試。');};
  syncControls(); loadMaps(); loadMarkerLayers();
})();
