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
  const mapCanvas = document.getElementById('mapCanvas');
  const zoomLevel = document.getElementById('zoomLevel');
  const analyze = document.getElementById('analyzeMap');
  const reset = document.getElementById('resetCrop');
  const captureButton = document.getElementById('captureWindow');
  const captureSelection = document.getElementById('captureSelection');
  const captureSelectCanvas = document.getElementById('captureSelectCanvas');
  const captureContext = captureSelectCanvas.getContext('2d');
  const worker = new Worker('matcher-worker.js?v=5');
  let zoom = 50;
  function setZoom(next) {
    zoom = Math.max(25, Math.min(300, next));
    mapCanvas.style.width = `${zoom}%`;
    zoomLevel.value = `${zoom}%`;
    document.getElementById('zoomOut').disabled = zoom === 25;
    document.getElementById('zoomIn').disabled = zoom === 300;
  }
  document.getElementById('zoomOut').addEventListener('click', () => setZoom(zoom - 25));
  document.getElementById('zoomIn').addEventListener('click', () => setZoom(zoom + 25));
  setZoom(50);
  function showMap(id, selectedCard) {
    for (const card of results.querySelectorAll('.egg-result')) {
      const selected=card===selectedCard;
      card.classList.toggle('is-selected', selected);
      card.setAttribute('aria-pressed', String(selected));
    }
    viewerTitle.textContent = `地圖 ${id}`;
    viewerImage.src = `maps/${id}.jpg`;
    viewerImage.alt = `候選地圖 ${id} 的完整標記地圖`;
    setZoom(50);
    viewer.hidden = false;
    viewer.scrollIntoView({behavior:'smooth', block:'start'});
  }
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
    results.replaceChildren(); viewer.hidden=true; viewerImage.removeAttribute('src'); draw();
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
    if (!navigator.mediaDevices?.getDisplayMedia) return;
    captureButton.disabled=true;
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
      captureButton.disabled=false;
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
    if (!image) return;
    try {
      const mask=getMask();
      analyze.disabled=true;results.replaceChildren();viewer.hidden=true;viewerImage.removeAttribute('src');
      setStatus('正在比對地圖輪廓，可能需要幾秒鐘…');
      worker.postMessage({type:'match',...mask});
    } catch(error){setStatus(error.message);}
  }
  analyze.addEventListener('click', startMatching);
  worker.onmessage=({data})=>{
    analyze.disabled=false;
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
  document.getElementById('closeViewer').addEventListener('click',()=>{viewer.hidden=true;viewerImage.removeAttribute('src');});
  worker.onerror=()=>{analyze.disabled=false;setStatus('辨識程式暫時無法執行，請重新整理後再試。');};
})();
