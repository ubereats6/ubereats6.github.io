'use strict';
const fs=require('node:fs/promises'),sync=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),https=require('node:https');
const {pathToFileURL}=require('node:url');
const BASE='https://ubereats6.github.io/egg-map/';
const allowed=p=>['maps.json','features.json','marker-layers.json'].includes(p)||/^(?:maps|clean-maps)\/(?:easy|hard|nightmare|chaos)\/[0-9]+\.webp$/.test(p)||/^marker-icons\/[a-z]+-[a-f0-9]+\.webp$/.test(p);
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
function validateIndex(index){
 if(index?.schema!==1||! /^[a-f0-9]{24}$/.test(index.version)||!Array.isArray(index.files)||index.files.length>15000)throw Error('地圖更新清單無效');
 const names=new Set();let total=0;
 for(const f of index.files){if(!allowed(f.path)||names.has(f.path)||!Number.isInteger(f.bytes)||f.bytes<1||f.bytes>16*1024*1024||! /^[a-f0-9]{64}$/.test(f.sha256))throw Error('地圖檔案資料無效');names.add(f.path);total+=f.bytes;}
 if(total>512*1024*1024||!['maps.json','features.json','marker-layers.json'].every(p=>names.has(p)))throw Error('地圖更新不完整');
}
function readDirectory(dir,index){
 validateIndex(index);
 for(const f of index.files){const b=sync.readFileSync(path.join(dir,f.path));if(b.length!==f.bytes||digest(b)!==f.sha256)throw Error('地圖檔案驗證失敗');if(f.path.endsWith('.webp')&&(b.toString('ascii',0,4)!=='RIFF'||b.toString('ascii',8,12)!=='WEBP'))throw Error('地圖圖片格式錯誤');}
 const manifest=JSON.parse(sync.readFileSync(path.join(dir,'maps.json'))),features=JSON.parse(sync.readFileSync(path.join(dir,'features.json'))),layers=JSON.parse(sync.readFileSync(path.join(dir,'marker-layers.json')));
 const levels=['easy','hard','nightmare','chaos'],files=new Set(index.files.map(f=>f.path));
 if(!Array.isArray(manifest.maps)||!manifest.maps.length||manifest.maps.length>5000||!Array.isArray(manifest.difficulties)||manifest.difficulties.length!==4||new Set(manifest.difficulties.map(d=>d.id)).size!==4||!manifest.difficulties.every(d=>levels.includes(d.id))||!Array.isArray(features)||!Array.isArray(layers.maps))throw Error('地圖資料結構錯誤');
 const ids=new Map();
 for(const m of manifest.maps){if(!Number.isInteger(m.id)||m.id<1||m.id>9999||ids.has(m.id)||!levels.includes(m.difficulty)||!files.has(m.image)||!files.has(m.cleanImage)||!m.image.endsWith('.webp')||!m.cleanImage.endsWith('.webp'))throw Error('地圖清單錯誤');ids.set(m.id,m.difficulty);}
 if(features.length!==ids.size||layers.maps.length!==ids.size)throw Error('地圖比對資料或圖層缺漏');
 for(const list of [features,layers.maps])if(new Set(list.map(m=>m.id)).size!==ids.size||!list.every(m=>ids.has(m.id)))throw Error('地圖編號不一致');
 for(const f of features){if(f.difficulty!==ids.get(f.id)||!Number.isInteger(f.w)||!Number.isInteger(f.h)||f.w<1||f.h<1||f.w*f.h>1000000||typeof f.mask!=='string'||Buffer.from(f.mask,'base64').length!==Math.ceil(f.w*f.h/8))throw Error('地圖輪廓資料錯誤');}
 for(const m of layers.maps){if(!Number.isFinite(m.width)||!Number.isFinite(m.height)||m.width<=0||m.height<=0||!Array.isArray(m.groups))throw Error('地圖圖層錯誤');for(const g of m.groups){if(!Array.isArray(g.elements))throw Error('地圖圖標錯誤');for(const e of g.elements){if(e.attrs?.href&&(!/^marker-icons\/[a-z]+-[a-f0-9]+\.webp$/.test(e.attrs.href)||!files.has(e.attrs.href)))throw Error('地圖圖標檔案缺漏');}}}
 const assetBase=pathToFileURL(dir+path.sep).href;
 return {version:index.version,manifest:{...manifest,maps:manifest.maps.map(m=>({...m,image:new URL(m.image,assetBase).href,cleanImage:new URL(m.cleanImage,assetBase).href}))},features,layers,assetBase};
}
function download(url,limit){return new Promise((resolve,reject)=>{
 const parsed=new URL(url);if(parsed.origin!==new URL(BASE).origin||!parsed.pathname.startsWith('/egg-map/'))return reject(Error('更新來源無效'));
 const req=https.get(parsed,res=>{if(res.statusCode!==200){res.resume();return reject(Error('網站尚未提供新版地圖資料'));}let size=0;const parts=[];res.on('data',part=>{size+=part.length;if(size>limit){res.destroy(Error('下載檔案過大'));return;}parts.push(part);});res.on('end',()=>resolve(Buffer.concat(parts)));res.on('error',reject);});req.setTimeout(12000,()=>req.destroy(Error('地圖更新連線逾時')));req.on('error',reject);
 });}
class Database{
 constructor(bundle,cache,get=download){this.bundle=bundle;this.cache=cache;this.get=get;this.current=readDirectory(bundle,JSON.parse(sync.readFileSync(path.join(bundle,'database-version.json'))));this.busy=null;try{const version=JSON.parse(sync.readFileSync(path.join(cache,'active.json'))).version;if(/^[a-f0-9]{24}$/.test(version)){const dir=path.join(cache,version);this.current=readDirectory(dir,JSON.parse(sync.readFileSync(path.join(dir,'database-version.json'))));}}catch(_){} }
 async check(progress=()=>{}){if(this.busy)return this.busy;this.busy=this.update(progress).finally(()=>{this.busy=null;});return this.busy;}
 async update(progress){
  progress('正在檢查地圖更新…');const index=JSON.parse(await this.get(BASE+'database-version.json?check='+Date.now(),2*1024*1024));validateIndex(index);
  if(index.version===this.current.version){progress('地圖資料已是最新');return {changed:false,data:this.current};}
  await fs.mkdir(this.cache,{recursive:true});const stage=path.join(this.cache,'.pending-'+crypto.randomBytes(6).toString('hex'));
  await fs.mkdir(stage);let done=0;
  try{
   const queue=[...index.files];let failed;const outcomes=await Promise.allSettled(Array.from({length:4},async()=>{while(queue.length&&!failed){const f=queue.shift();try{let b;const oldDir=this.current.assetBase.startsWith('file:')?require('node:url').fileURLToPath(this.current.assetBase):this.bundle;try{const old=await fs.readFile(path.join(oldDir,f.path));if(digest(old)===f.sha256)b=old;}catch(_){}if(!b)b=await this.get(BASE+f.path+'?v='+index.version,f.bytes+1);if(b.length!==f.bytes||digest(b)!==f.sha256)throw Error('下載資料未通過驗證');await fs.mkdir(path.dirname(path.join(stage,f.path)),{recursive:true});await fs.writeFile(path.join(stage,f.path),b);progress(`下載地圖資料 ${++done}/${index.files.length}`);}catch(e){failed=e;throw e;}}}));if(failed)throw failed;for(const result of outcomes)if(result.status==='rejected')throw result.reason;
   await fs.writeFile(path.join(stage,'database-version.json'),JSON.stringify(index));readDirectory(stage,index);
   const dest=path.join(this.cache,index.version);await fs.rm(dest,{recursive:true,force:true});await fs.rename(stage,dest);const data=readDirectory(dest,index);
   await fs.writeFile(path.join(this.cache,'active.tmp'),JSON.stringify({version:index.version}));await fs.rename(path.join(this.cache,'active.tmp'),path.join(this.cache,'active.json'));this.current=data;progress('地圖更新完成');return {changed:true,data};
  }catch(e){await fs.rm(stage,{recursive:true,force:true});throw e;}
 }
}
module.exports={Database,validateIndex,readDirectory,BASE};
