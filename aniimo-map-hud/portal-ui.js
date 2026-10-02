(function(root){
 'use strict';
 const NS='http://www.w3.org/2000/svg';
 function node(tag,attrs={}){const e=document.createElementNS(NS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));return e;}
 function groups(layer,assetBase,options={}){
  const scale=options.scale||1.43,result=[];
  for(const entry of layer?.groups||[]){
   if(!['main','side'].includes(entry.type)||options.visibility?.[entry.type]===false)continue;
   const icon=entry.elements.find(e=>e.tag==='image');if(!icon||!/^marker-icons\/[a-z]+-[a-f0-9]+\.webp$/.test(icon.attrs.href))continue;
   const a=icon.attrs,w=Number(a.width)*scale,h=Number(a.height)*scale,cx=Number(a.x)+Number(a.width)/2,cy=Number(a.y)+Number(a.height)/2;
   if(![w,h,cx,cy].every(Number.isFinite))continue;
   const x=cx-w/2,y=cy-h/2,pad=5,l=x-pad,t=y-pad,r=x+w+pad,b=y+h+pad,len=9;
   const g=node('g',{'class':'portal-marker portal-'+entry.type});
   g.append(node('image',{x,y,width:w,height:h,href:new URL(a.href,assetBase).href}));
   g.append(node('path',{'class':'portal-frame',d:`M ${l} ${t+len} V ${t} H ${l+len} M ${r-len} ${t} H ${r} V ${t+len} M ${r} ${b-len} V ${b} H ${r-len} M ${l+len} ${b} H ${l} V ${b-len}`,fill:'none','stroke-width':2,'stroke-linecap':'round'}));
   result.push(g);
  }
  return result;
 }
 function thumbnail(container,map,layer,assetBase){
  if(!layer)return;
  container.classList.add('portal-preview');
  const svg=node('svg',{'class':'portal-thumbnail',viewBox:`0 0 ${layer.width} ${layer.height}`,'aria-hidden':'true',preserveAspectRatio:'xMidYMid meet'});
  svg.append(...groups(layer,assetBase,{scale:2}));container.append(svg);
 }
 root.MapPortals={groups,thumbnail};
})(window);
