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
  const analyze = document.getElementById('analyzeMap');
  const reset = document.getElementById('resetCrop');
  const worker = new Worker('matcher-worker.js?v=5');
  let image = null, imageUrl = null, crop = null, start = null;
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
  upload.addEventListener('change', () => {
    const file = upload.files?.[0]; if (!file) return;
    if (!/^image\/(png|jpeg|webp)$/.test(file.type) || file.size > 20*1024*1024) {
      setStatus('請選擇 20 MB 以下的 PNG、JPG 或 WebP 圖片。'); return;
    }
    const url = URL.createObjectURL(file);
    const next = new Image();
    next.onload = () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      imageUrl=url; image=next;
      const scale=Math.min(1,850/next.naturalWidth,650/next.naturalHeight);
      canvas.width=Math.max(1,Math.round(next.naturalWidth*scale));
      canvas.height=Math.max(1,Math.round(next.naturalHeight*scale));
      crop={x:0,y:0,w:canvas.width,h:canvas.height};
      area.hidden=false; name.textContent=file.name;
      results.replaceChildren(); viewer.hidden=true; viewerImage.removeAttribute('src'); draw();
      setStatus('請框選地圖區域，再開始比對。');
    };
    next.onerror=()=>{URL.revokeObjectURL(url);setStatus('圖片讀取失敗，請換一張截圖。');};
    next.src=url;
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
  analyze.addEventListener('click', () => {
    if (!image) return;
    try {
      const mask=getMask();
      analyze.disabled=true;results.replaceChildren();viewer.hidden=true;viewerImage.removeAttribute('src');
      setStatus('正在比對地圖輪廓，可能需要幾秒鐘…');
      worker.postMessage({type:'match',...mask});
    } catch(error){setStatus(error.message);}
  });
  worker.onmessage=({data})=>{
    analyze.disabled=false;
    if(data.type==='error'){setStatus(data.message);return;}
    if(!data.results.length){setStatus('沒有足夠的地圖線索，請換一張截圖。');return;}
    const cards=data.results.map((item,index)=>{
      const card=document.createElement('button');card.type='button';card.className='egg-result';
      const rank=document.createElement('small');rank.textContent=`候選 ${index+1}`;
      const title=document.createElement('strong');title.textContent=`地圖 ${item.id}`;
      const score=document.createElement('span');score.textContent=`輪廓分數 ${Math.min(100,Math.max(0,Math.round(item.score*100)))}`;
      card.append(rank,title,score);
      card.addEventListener('click',()=>{viewerTitle.textContent=`地圖 ${item.id}`;viewerImage.src=`maps/${item.id}.jpg`;viewerImage.alt=`候選地圖 ${item.id} 的完整地圖`;viewer.hidden=false;viewer.scrollIntoView({behavior:'smooth',block:'start'});});
      return card;
    });
    results.replaceChildren(...cards);
    setStatus('這是輪廓比對的候選排序，不代表已確定是哪張地圖。');
  };
  document.getElementById('closeViewer').addEventListener('click',()=>{viewer.hidden=true;viewerImage.removeAttribute('src');});
  worker.onerror=()=>{analyze.disabled=false;setStatus('辨識程式暫時無法執行，請重新整理後再試。');};
})();
