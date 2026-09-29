const capture=document.getElementById('capture');
const sources=document.getElementById('sources');
const upload=document.getElementById('upload');
const selection=document.getElementById('selection');
const canvas=document.getElementById('preview');
const ctx=canvas.getContext('2d',{willReadFrequently:true});
const status=document.getElementById('status');
const resultsPanel=document.getElementById('resultsPanel');
const results=document.getElementById('results');
const worker=new Worker('matcher-worker.js');
let image=null, crop=null, start=null;
const say=message=>{status.textContent=message;};

capture.addEventListener('click',async()=>{
  capture.disabled=true;sources.replaceChildren();say('正在取得目前的視窗畫面…');
  try{
    const frames=await window.mapHud.captureSources();
    if(!frames.length) throw new Error('找不到可擷取的視窗。請開啟遊戲地圖後再試。');
    for(const frame of frames){
      const button=document.createElement('button');button.type='button';button.className='source';
      const img=document.createElement('img');img.src=frame.shot;img.alt='';
      const label=document.createElement('span');label.textContent=frame.name;
      button.append(img,label);
      button.addEventListener('click',()=>setImage(frame.shot));
      sources.append(button);
    }
    say('選擇顯示遊戲地圖的視窗或螢幕。');
  }catch(error){say(error.message||'擷取失敗，請改用截圖檔。');}
  finally{capture.disabled=false;}
});
upload.addEventListener('change',()=>{
  const file=upload.files?.[0];if(!file)return;
  if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>20*1024*1024){say('請選擇 20 MB 以下的 PNG、JPG 或 WebP。');return;}
  const reader=new FileReader();reader.onload=()=>setImage(reader.result);reader.onerror=()=>say('檔案讀取失敗。');reader.readAsDataURL(file);
});
function setImage(url){
  const next=new Image();
  next.onload=()=>{
    image=next;
    const scale=Math.min(1,1920/next.naturalWidth,1200/next.naturalHeight);
    canvas.width=Math.max(1,Math.round(next.naturalWidth*scale));canvas.height=Math.max(1,Math.round(next.naturalHeight*scale));
    crop=null;selection.hidden=false;resultsPanel.hidden=true;results.replaceChildren();draw();
    selection.scrollIntoView({behavior:'smooth'});say('在圖片上框選地圖區域，放開後會自動比對。');
  };
  next.onerror=()=>say('畫面讀取失敗，請換一個視窗或截圖。');next.src=url;
}
function draw(){
  if(!image)return;
  ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
  if(!crop)return;
  ctx.fillStyle='rgba(0,7,17,.6)';ctx.fillRect(0,0,canvas.width,crop.y);
  ctx.fillRect(0,crop.y,crop.x,crop.h);ctx.fillRect(crop.x+crop.w,crop.y,canvas.width-crop.x-crop.w,crop.h);
  ctx.fillRect(0,crop.y+crop.h,canvas.width,canvas.height-crop.y-crop.h);
  ctx.strokeStyle='#75ddff';ctx.lineWidth=3;ctx.strokeRect(crop.x,crop.y,crop.w,crop.h);
}
function point(event){const box=canvas.getBoundingClientRect();return {
  x:Math.max(0,Math.min(canvas.width,Math.round((event.clientX-box.left)*canvas.width/box.width))),
  y:Math.max(0,Math.min(canvas.height,Math.round((event.clientY-box.top)*canvas.height/box.height)))};}
canvas.addEventListener('pointerdown',event=>{start=point(event);crop={...start,w:0,h:0};canvas.setPointerCapture(event.pointerId);draw();});
canvas.addEventListener('pointermove',event=>{if(!start)return;const end=point(event);crop={x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),w:Math.abs(end.x-start.x),h:Math.abs(end.y-start.y)};draw();});
canvas.addEventListener('pointerup',event=>{
  if(!start)return;const end=point(event);crop={x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),w:Math.abs(end.x-start.x),h:Math.abs(end.y-start.y)};start=null;draw();
  if(crop.w<20||crop.h<20){say('請框選至少 20 像素的地圖區域。');return;}match();
});
canvas.addEventListener('pointercancel',()=>{start=null;crop=null;draw();});
document.getElementById('retry').addEventListener('click',()=>{crop=null;draw();say('請重新拖曳框選地圖。');});
document.getElementById('full').addEventListener('click',()=>{crop={x:0,y:0,w:canvas.width,h:canvas.height};draw();match();});
function maskFromCrop(){
  const target=document.createElement('canvas');const scale=116/Math.max(crop.w,crop.h);
  target.width=Math.max(1,Math.round(crop.w*scale));target.height=Math.max(1,Math.round(crop.h*scale));
  const c=target.getContext('2d',{willReadFrequently:true});
  c.drawImage(image,crop.x*image.naturalWidth/canvas.width,crop.y*image.naturalHeight/canvas.height,
    crop.w*image.naturalWidth/canvas.width,crop.h*image.naturalHeight/canvas.height,0,0,target.width,target.height);
  const pixels=c.getImageData(0,0,target.width,target.height).data;
  const mask=new Uint8Array(target.width*target.height);let left=target.width,top=target.height,right=-1,bottom=-1,count=0;
  for(let y=0;y<target.height;y++)for(let x=0;x<target.width;x++){
    const i=y*target.width+x,p=i*4,brightness=(pixels[p]+pixels[p+1]+pixels[p+2])/3;
    if(brightness>55&&brightness<228){mask[i]=1;count++;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  }
  if(count<60||count/mask.length>.84)throw new Error('框選區域缺少清楚的地圖路徑，請縮小範圍並避開其他介面。');
  left=Math.max(0,left-1);top=Math.max(0,top-1);right=Math.min(target.width-1,right+1);bottom=Math.min(target.height-1,bottom+1);
  const w=right-left+1,h=bottom-top+1,out=new Uint8Array(w*h);
  for(let y=0;y<h;y++)for(let x=0;x<w;x++)out[y*w+x]=mask[(y+top)*target.width+x+left];
  return {w,h,pixels:out};
}
function match(){
  try{const data=maskFromCrop();resultsPanel.hidden=true;results.replaceChildren();say('正在比對地圖輪廓…');worker.postMessage({type:'match',...data});}
  catch(error){say(error.message);}
}
worker.onmessage=({data})=>{
  if(data.type==='error'){say(data.message);return;}
  if(!data.results?.length){say('找不到候選地圖，請重新框選。');return;}
  window.mapHud.matchResults(data.results.map(item=>item.id));
  for(const [rank,item] of data.results.entries()){
    const card=document.createElement('button');card.type='button';card.className='candidate';
    const small=document.createElement('small');small.textContent=`候選 ${rank+1}`;
    const strong=document.createElement('strong');strong.textContent=`地圖 ${item.id}`;
    const score=document.createElement('span');score.textContent=`輪廓分數 ${Math.min(100,Math.max(0,Math.round(item.score*100)))}`;
    card.append(small,strong,score);card.addEventListener('click',()=>window.mapHud.chooseMatch(item.id));results.append(card);
  }
  resultsPanel.hidden=false;resultsPanel.scrollIntoView({behavior:'smooth'});say('比對完成，請選擇最像的一張地圖。');
};
worker.onerror=()=>say('辨識程式無法執行，請重新開啟 HUD。');
