(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.EggDoors=api;})(typeof window!=='undefined'?window:globalThis,function(){
 const directions=['E','NE','N','NW','W','SW','S','SE'];
 function direction(layer){
  const points={};for(const group of layer?.groups||[]){if(!['main','side'].includes(group.type))continue;const icon=group.elements.find(e=>e.tag==='image');if(icon){const a=icon.attrs;points[group.type]={x:Number(a.x)+Number(a.width)/2,y:Number(a.y)+Number(a.height)/2};}}
  if(!points.main||!points.side)return null;
  const dx=points.side.x-points.main.x,dy=points.side.y-points.main.y;if(!Number.isFinite(dx)||!Number.isFinite(dy)||Math.hypot(dx,dy)<1)return null;
  return directions[((Math.floor((Math.atan2(-dy,dx)+Math.PI/8)/(Math.PI/4))%8)+8)%8];
 }
 function pool(value){return value==='chaos'?'nightmare':value;}
 function matches(map,value){return map?.difficulty===pool(value);}
 function candidates(maps,layers,difficulty,selected){return maps.filter(m=>matches(m,difficulty)&&(!selected||selected==='all'||direction(layers.get(m.id))===selected));}
 return {pool,matches,direction,candidates};
});
