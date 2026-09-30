const $=id=>document.getElementById(id);
const canvas=$('preview'),ctx=canvas.getContext('2d',{willReadFrequently:true}),viewport=$('cropViewport');
const video=$('captureVideo'),frameCanvas=document.createElement('canvas'),frameContext=frameCanvas.getContext('2d',{willReadFrequently:true});
const worker=new Worker('matcher-worker.js'),modes=[...document.querySelectorAll('[name="difficulty"]')];
const dialog=$('candidateDialog'),choices=$('candidateChoices'),previewDialog=$('previewDialog');
let maps=new Map(),difficulty=null,step='mode',image=null,crop=null,start=null,panStart=null;
let source=null,stream=null,liveGeneration=0,frameLoop=null,requestId=0,matching=false,busy=false;
let zoom=100,panMode=false,spaceDown=false,results=[];
const say=message=>{$('status').textContent=message;};
function controls(){
 $('nextSource').disabled=!difficulty||!maps.size||busy;$('upload').disabled=$('nextSource').disabled;
 $('refreshSources').disabled=busy;$('resumeLive').disabled=!source||matching||busy;
 for(const id of ['matchCrop','full','retry'])$(id).disabled=!image||matching;
 $('matchCrop').disabled=matching||!crop||crop.w<20||crop.h<20;
 $('updateCandidates').disabled=!source;$('reopenResults').hidden=!results.length;
 modes.forEach(input=>input.disabled=busy);
}
function closeDialogs(){if(previewDialog.open)previewDialog.close();if(dialog.open)dialog.close();}
function clearResults(){requestId++;matching=false;results=[];choices.replaceChildren();closeDialogs();window.mapHud.clearMatches();controls();}
function showStep(next){
 if(next!=='crop')stopLive();step=next;
 for(const name of ['mode','source','crop'])$(name+'Step').hidden=next!==name;
 window.mapHud.matcherStep(next);controls();
}
function chooseMode(value){if(difficulty===value)return;difficulty=value;clearResults();modes.forEach(input=>input.checked=input.value===value);say('確認難度後，按「下一步」選遊戲視窗。');}
modes.forEach(input=>input.addEventListener('change',()=>{window.mapHud.setDifficulty(input.value);chooseMode(input.value);}));
window.mapHud.onRestart(()=>{clearResults();showStep('mode');say('請先確認這次搶蛋難度。');});
window.mapHud.onState(state=>{if(state.difficulty&&modes.some(input=>input.value===state.difficulty))chooseMode(state.difficulty);});
fetch('maps.json').then(r=>r.json()).then(data=>{maps=new Map(data.maps.map(m=>[m.id,m]));controls();}).catch(()=>say('地圖資料載入失敗，請完整解壓縮下載包。'));
async function loadSources(){
 if(!difficulty||busy)return;clearResults();showStep('source');busy=true;controls();$('sources').replaceChildren();say('正在列出可選視窗…');
 try{
  const frames=await window.mapHud.captureSources();
  if(!frames.length)throw Error('找不到視窗，請開啟遊戲地圖後重新整理。');
  for(const frame of frames){
   const button=document.createElement('button');button.type='button';button.className='source';
   const thumb=document.createElement('img');thumb.src=frame.shot;thumb.alt='';
   const name=document.createElement('span');name.textContent=frame.name;button.append(thumb,name);
   button.addEventListener('click',()=>startSource(frame));$('sources').append(button);
  }
  say('直接點選遊戲視窗，下一步會顯示即時畫面。');
 }catch(e){say(e.message||'取得視窗失敗，請重試。');}finally{busy=false;controls();}
}
$('nextSource').addEventListener('click',loadSources);$('refreshSources').addEventListener('click',loadSources);
$('backMode').addEventListener('click',()=>{clearResults();showStep('mode');});
$('backSources').addEventListener('click',loadSources);
function stopLive(){
 liveGeneration++;if(frameLoop!==null){cancelAnimationFrame(frameLoop);frameLoop=null;}
 if(stream){stream.getTracks().forEach(track=>track.stop());stream=null;}
 video.srcObject=null;window.mapHud.stopLiveSource();
 $('liveState').textContent=image?'已凍結畫面':'尚未取得畫面';$('liveState').classList.add('paused');
}
function refreshFrame(){
 if(!video.videoWidth||video.readyState<2)return false;
 const scale=Math.min(1,4096/video.videoWidth,2160/video.videoHeight);
 const w=Math.max(1,Math.round(video.videoWidth*scale)),h=Math.max(1,Math.round(video.videoHeight*scale));
 if(frameCanvas.width!==w||frameCanvas.height!==h){frameCanvas.width=w;frameCanvas.height=h;canvas.width=w;canvas.height=h;fitSize();}
 frameContext.drawImage(video,0,0,w,h);frameCanvas.naturalWidth=w;frameCanvas.naturalHeight=h;image=frameCanvas;draw();return true;
}
async function startSource(selected){
 if(busy)return;stopLive();source=selected;clearResults();image=null;ctx.clearRect(0,0,canvas.width,canvas.height);crop=null;zoom=100;showStep('crop');
 $('sourceName').textContent='目前來源：'+selected.name;busy=true;controls();say('正在連接所選視窗的即時預覽…');
 const generation=liveGeneration;let nextStream;
 try{
  if(!await window.mapHud.selectLiveSource(selected.id))throw Error('來源已失效，請重新選擇視窗。');
  nextStream=await navigator.mediaDevices.getDisplayMedia({video:{frameRate:{ideal:12,max:15}},audio:false});
  if(generation!==liveGeneration||step!=='crop'){nextStream.getTracks().forEach(t=>t.stop());return;}
  stream=nextStream;video.srcObject=stream;await video.play();
  if(generation!==liveGeneration){nextStream.getTracks().forEach(t=>t.stop());return;}
  stream.getVideoTracks()[0]?.addEventListener('ended',()=>{if(stream===nextStream){stopLive();say('來源已停止；可以更新畫面或重新選擇視窗。');}});
  function tick(){if(generation!==liveGeneration||!stream||step!=='crop')return;refreshFrame();frameLoop=requestAnimationFrame(tick);}
  tick();$('liveState').textContent='● 即時更新中';$('liveState').classList.remove('paused');
  say('視窗內容會即時更新。滾輪放大後框選；開始框選就凍結當下畫面。');
 }catch(e){stopLive();say('即時預覽無法開啟：'+(e.message||'請重新選視窗，或使用截圖檔。'));}
 finally{busy=false;controls();}
}
$('resumeLive').addEventListener('click',()=>{if(source)startSource(source);});
$('upload').addEventListener('change',()=>{
 const file=$('upload').files?.[0];if(!file||!difficulty)return;
 if(!/^image\/(png|jpeg|webp)$/.test(file.type)||file.size>20*1024*1024){say('請選擇 20 MB 以下的 PNG、JPG 或 WebP。');return;}
 stopLive();source=null;clearResults();const generation=liveGeneration;const reader=new FileReader();
 reader.onload=()=>{const next=new Image();next.onload=()=>{
  if(generation!==liveGeneration)return;
  frameCanvas.width=next.naturalWidth;frameCanvas.height=next.naturalHeight;frameContext.drawImage(next,0,0);
  frameCanvas.naturalWidth=next.naturalWidth;frameCanvas.naturalHeight=next.naturalHeight;image=frameCanvas;
  canvas.width=frameCanvas.width;canvas.height=frameCanvas.height;crop=null;zoom=100;showStep('crop');
  $('sourceName').textContent='截圖檔：'+file.name;fitSize();draw();controls();say('滾輪放大後拖曳框選；截圖檔為靜態畫面。');
 };next.onerror=()=>say('截圖讀取失敗。');next.src=reader.result;};reader.onerror=()=>say('檔案讀取失敗。');reader.readAsDataURL(file);
});
function fitSize(){
 if(!canvas.width||!canvas.height)return;
 const fit=Math.max(1,viewport.clientWidth-2)/canvas.width;
 canvas.style.width=Math.max(1,canvas.width*fit*zoom/100)+'px';canvas.style.height=Math.max(1,canvas.height*fit*zoom/100)+'px';
 $('zoomLevel').value=Math.round(zoom)+'%';
}
function setZoom(next,anchor){
 const before=canvas.getBoundingClientRect(),point=anchor?{x:(anchor.x-before.left)/before.width,y:(anchor.y-before.top)/before.height}:null;
 zoom=Math.max(25,Math.min(800,next));fitSize();
 if(point){const after=canvas.getBoundingClientRect();viewport.scrollLeft+=after.left+point.x*after.width-anchor.x;viewport.scrollTop+=after.top+point.y*after.height-anchor.y;}
}
viewport.addEventListener('wheel',event=>{if(!image||matching)return;event.preventDefault();setZoom(zoom*(event.deltaY<0?1.15:1/1.15),{x:event.clientX,y:event.clientY});},{passive:false});
$('zoomIn').addEventListener('click',()=>setZoom(zoom*1.25));$('zoomOut').addEventListener('click',()=>setZoom(zoom/1.25));
$('fit').addEventListener('click',()=>{zoom=100;fitSize();viewport.scrollLeft=viewport.scrollTop=0;});window.addEventListener('resize',fitSize);
function setPan(value){panMode=value;viewport.classList.toggle('pan',value);$('panMode').classList.toggle('active',value);$('selectMode').classList.toggle('active',!value);}
$('panMode').addEventListener('click',()=>setPan(true));$('selectMode').addEventListener('click',()=>setPan(false));
document.addEventListener('keydown',e=>{if(e.code==='Space'&&step==='crop'&&!dialog.open&&!previewDialog.open&&!['INPUT','BUTTON'].includes(e.target.tagName)){e.preventDefault();spaceDown=true;}});
document.addEventListener('keyup',e=>{if(e.code==='Space')spaceDown=false;});window.addEventListener('blur',()=>{spaceDown=false;panStart=null;});
function draw(){
 if(!image)return;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
 if(!crop)return;ctx.fillStyle='rgba(0,7,17,.6)';ctx.fillRect(0,0,canvas.width,crop.y);ctx.fillRect(0,crop.y,crop.x,crop.h);
 ctx.fillRect(crop.x+crop.w,crop.y,canvas.width-crop.x-crop.w,crop.h);ctx.fillRect(0,crop.y+crop.h,canvas.width,canvas.height-crop.y-crop.h);
 ctx.strokeStyle='#75ddff';ctx.lineWidth=2;ctx.strokeRect(crop.x,crop.y,crop.w,crop.h);
}
function point(e){const b=canvas.getBoundingClientRect();return{x:Math.max(0,Math.min(canvas.width,(e.clientX-b.left)*canvas.width/b.width)),y:Math.max(0,Math.min(canvas.height,(e.clientY-b.top)*canvas.height/b.height))};}
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{
 if(!image||matching||busy)return;canvas.setPointerCapture(e.pointerId);
 if(panMode||spaceDown||e.button===2){e.preventDefault();panStart={x:e.clientX,y:e.clientY,left:viewport.scrollLeft,top:viewport.scrollTop};return;}
 if(e.button!==0)return;
 if(stream)refreshFrame();stopLive();start=point(e);crop={...start,w:0,h:0};draw();
});
canvas.addEventListener('pointermove',e=>{
 if(panStart){viewport.scrollLeft=panStart.left+panStart.x-e.clientX;viewport.scrollTop=panStart.top+panStart.y-e.clientY;return;}
 if(!start)return;const end=point(e);crop={x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),w:Math.abs(end.x-start.x),h:Math.abs(end.y-start.y)};draw();
});
canvas.addEventListener('pointerup',e=>{
 if(panStart){panStart=null;return;}if(!start)return;const end=point(e);crop={x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),w:Math.abs(end.x-start.x),h:Math.abs(end.y-start.y)};start=null;draw();controls();
 if(crop.w<20||crop.h<20){say('範圍太小，請放大後重新框選。');return;}match();
});
canvas.addEventListener('pointercancel',()=>{start=null;panStart=null;crop=null;draw();controls();});
function reframe(){closeDialogs();crop=null;start=null;panStart=null;setPan(false);showStep('crop');draw();controls();say('已保留原畫面與縮放，可直接重新框選；按「更新畫面」可取得新畫面。');}
$('retry').addEventListener('click',reframe);$('reframeCandidates').addEventListener('click',reframe);
$('matchCrop').addEventListener('click',match);
$('full').addEventListener('click',()=>{if(stream)refreshFrame();stopLive();crop={x:0,y:0,w:canvas.width,h:canvas.height};draw();match();});
$('closeCandidates').addEventListener('click',()=>dialog.close());$('closePreview').addEventListener('click',()=>previewDialog.close());
$('updateCandidates').addEventListener('click',()=>{closeDialogs();if(source)startSource(source);});
$('reopenResults').addEventListener('click',()=>{if(results.length)dialog.showModal();});
window.addEventListener('beforeunload',stopLive);
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
}function match(){
 if(!difficulty||!image||!crop||matching)return;
 try{
  const data=maskFromCrop();clearResults();matching=true;controls();say('正在比對所選難度的地圖輪廓…');
  worker.postMessage({type:'match',difficulty,requestId:++requestId,...data});
 }catch(e){matching=false;controls();say(e.message);}
}
worker.onmessage=({data})=>{
 if(data.requestId!==requestId||data.difficulty!==difficulty)return;matching=false;controls();
 if(data.type==='error'){say(data.message);return;}
 results=(data.results||[]).filter(item=>maps.get(item.id)?.difficulty===difficulty).slice(0,4);
 if(!results.length){say('沒有足夠線索，請重新框選。');return;}
 window.mapHud.matchResults({difficulty,ids:results.map(item=>item.id)});
 choices.replaceChildren(...results.map((item,index)=>{
  const article=document.createElement('article');article.className='candidate'+(index===0?' top':'');
  const preview=document.createElement('button');preview.type='button';preview.className='preview-button';preview.setAttribute('aria-label',`放大預覽地圖 ${item.id}`);
  const thumb=document.createElement('img');thumb.src=maps.get(item.id).image;thumb.alt=`地圖 ${item.id} 縮圖`;preview.append(thumb);
  const rank=document.createElement('small');rank.textContent=index===0?'候選 1 · 最相似':`候選 ${index+1}`;
  const title=document.createElement('strong');title.textContent=`地圖 ${item.id}`;const score=document.createElement('p');score.textContent=`輪廓分數 ${Math.min(100,Math.max(0,Math.round(item.score*100)))}`;
  const actions=document.createElement('div');actions.className='actions';const enlarge=document.createElement('button');enlarge.type='button';enlarge.textContent='放大預覽';
  function openPreview(){$('previewTitle').textContent=`地圖 ${item.id}`;$('largeMap').src=maps.get(item.id).image;previewDialog.showModal();}
  preview.addEventListener('click',openPreview);enlarge.addEventListener('click',openPreview);
  const choose=document.createElement('button');choose.type='button';choose.className='primary';choose.textContent='使用這張';choose.addEventListener('click',()=>{closeDialogs();stopLive();window.mapHud.chooseMatch(item.id);});
  actions.append(enlarge,choose);article.append(preview,rank,title,score,actions);return article;
 }));
 controls();dialog.showModal();say('比對完成。可放大預覽或按「重新框選」，不用先選地圖。');
};
worker.onerror=()=>{matching=false;controls();say('比對程式發生錯誤，請重新開啟 HUD。');};
showStep('mode');controls();
