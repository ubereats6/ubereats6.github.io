(() => {
  const audio=document.getElementById('bgMusic');
  if(!audio)return;
  const root=new URL('.',document.currentScript.src);
  const tracks=[{name:'KartRider BGM',file:'assets/kartrider_music.mp3'},{name:'羞羞獺之歌 - 伊莫',file:'assets/aniimo-shy-otter-song.mp3'}];
  let index=0,change=0;
  audio.loop=false;audio.removeAttribute('loop');
  const title=document.querySelector('.now-playing-title');
  const card=document.getElementById('nowPlaying');if(card)card.style.pointerEvents='auto';
  const select=document.createElement('select');select.setAttribute('aria-label','選擇背景音樂');
  select.style.cssText='width:0;flex:1;min-width:0;max-width:100%;font:inherit;font-size:12px;color:inherit;background:#102745;border:1px solid #315b83;border-radius:5px;padding:3px;cursor:pointer';
  tracks.forEach((track,i)=>{const option=document.createElement('option');option.value=String(i);option.textContent=track.name;select.append(option);});
  if(title){
    title.style.cssText='display:flex;align-items:center;gap:6px;min-width:0;white-space:normal;overflow:visible';
    const next=document.createElement('button');next.type='button';next.textContent='下一首';next.setAttribute('aria-label','播放下一首背景音樂');
    next.style.cssText='flex:none;margin:0;border:1px solid #5ca6d1;border-radius:6px;background:#163d60;color:#e7f5ff;font:inherit;font-size:11px;padding:4px 9px;cursor:pointer';
    next.addEventListener('click',()=>choose((index+1)%tracks.length,true));
    title.replaceChildren(select,next);
  }
  async function choose(next,play){
    const generation=++change;index=next;select.value=String(index);
    try{localStorage.setItem('ubereats6MusicTrack',String(index));}catch(_){}
    audio.pause();audio.src=new URL(tracks[index].file,root).href;audio.load();
    document.getElementById('musicToggle')?.classList.remove('has-error');
    if(play){try{if(typeof window.playMusic==='function')await window.playMusic();else await audio.play();if(generation===change)window.renderMusicState?.(!audio.paused);}catch(_){if(generation===change)window.renderMusicState?.(false);}}
  }
  select.addEventListener('change',()=>choose(Number(select.value),!audio.paused));
  audio.addEventListener('ended',()=>choose((index+1)%tracks.length,true));
  let saved=0;try{saved=Number(localStorage.getItem('ubereats6MusicTrack'))===1?1:0;}catch(_){}
  if(saved)choose(saved,false);
})();
