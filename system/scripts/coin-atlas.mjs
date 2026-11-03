export const DEFAULT_COIN_ATLAS='systems/vitruviy/assets/coin.json';
const cache=new Map();
export function validAtlasPath(path) {
  return typeof path==='string' && /\.(json|png|jpe?g|webp)$/i.test(path.trim().split(/[?#]/)[0]) && !/^(?:javascript|data|file):/i.test(path.trim());
}
const absolute=(path,base=globalThis.location?.href??'http://localhost/')=>new URL(path,base).href;
const isJSON=path=>/\.json$/i.test(path.split(/[?#]/)[0]);
const portable=(path,base)=>{const url=new URL(absolute(path,base)),local=new URL(globalThis.location?.href??'http://localhost/');return url.origin===local.origin?url.pathname+url.search+url.hash:url.href;};
export function validateCoinFrames(data,width,height) {
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw new Error('Invalid coin atlas size');
  for(const name of ['failure.png','success.png']) {
    const f=data.frames?.[name]?.frame;
    if(!f||!['x','y','w','h'].every(k=>Number.isFinite(f[k]))||f.x<0||f.y<0||f.w<=0||f.h<=0||f.x+f.w>width||f.y+f.h>height)throw new Error('Invalid coin atlas frame: '+name);
  }
  return {image:data.meta.image,width,height,frames:data.frames};
}
export async function readCoinAtlas(path,{fresh=false}={}) {
  path=path?.trim()||DEFAULT_COIN_ATLAS;
  if(!validAtlasPath(path))throw new Error('Invalid coin atlas path');
  if(path===DEFAULT_COIN_ATLAS)return {image:'systems/vitruviy/assets/coin.png',width:672,height:280,frames:{'failure.png':{frame:{x:308,y:7,w:251,h:251}},'success.png':{frame:{x:36,y:7,w:251,h:251}}}};
  if(fresh)cache.delete(path);
  if(!cache.has(path))cache.set(path,(async()=>{
    if(isJSON(path)) {
      const response=await fetch(path);if(!response.ok)throw new Error('Coin atlas HTTP '+response.status);
      const data=await response.json();
      if(typeof data.meta?.image!=='string'||!validAtlasPath(data.meta.image)||isJSON(data.meta.image))throw new Error('Invalid coin atlas image');
      data.meta.image=portable(data.meta.image,absolute(path));
      const image=new Image();image.src=data.meta.image;await image.decode();
      const width=image.naturalWidth,height=image.naturalHeight;
      return validateCoinFrames(data,width,height);
    }
    const image=new Image();image.src=path;await image.decode();
    const width=image.naturalWidth,height=image.naturalHeight,half=Math.floor(width/2);
    return validateCoinFrames({meta:{image:portable(path)},frames:{'success.png':{frame:{x:0,y:0,w:half,h:height}},'failure.png':{frame:{x:half,y:0,w:width-half,h:height}}}},width,height);
  })().catch(error=>{cache.delete(path);throw error;}));
  return cache.get(path);
}
export async function saveCoinAtlas(path) {
  path=path?.trim()||DEFAULT_COIN_ATLAS;
  const atlas=await readCoinAtlas(path,{fresh:true});
  if(path===DEFAULT_COIN_ATLAS)return {source:path,texture:path,atlas};
  // A normal sprite sheet gets a real JSON atlas, just like the d6 presets.
  const picker=foundry.applications.apps.FilePicker.implementation;
  const folder='vitruviy-assets',listing=await picker.browse('data','');
  if(!listing.dirs?.includes(folder))await picker.createDirectory('data',folder);
  const name=`coin-atlas-${Date.now()}.json`;
  // DSN 6.3.1 concatenates the atlas directory and meta.image. A relative image
  // path is required; a root path or absolute URL becomes an invalid URL there.
  const imageURL=new URL(absolute(atlas.image)),directory=new URL(absolute(folder+'/'));
  if(imageURL.origin!==directory.origin)throw new Error('Coin atlas image must be stored in Foundry');
  const from=directory.pathname.split('/').filter(Boolean),to=imageURL.pathname.split('/').filter(Boolean);
  let shared=0;while(shared<from.length&&shared<to.length&&from[shared]===to[shared])shared++;
  const relative='../'.repeat(from.length-shared)+to.slice(shared).join('/')+imageURL.search;
  const data={frames:atlas.frames,meta:{image:relative+(relative.includes('?')?'&':'?')+'v='+Date.now(),size:{w:atlas.width,h:atlas.height}}};
  const uploaded=await picker.upload('data',folder,new File([JSON.stringify(data)],name,{type:'application/json'}),{},{notify:false});
  if(!uploaded?.path)throw new Error('Coin atlas upload failed');
  return {source:path,texture:uploaded.path,atlas};
}
export async function currentCoinAtlas() {
  return readCoinAtlas(game.settings.get('vitruviy','coinAtlasTexture')||DEFAULT_COIN_ATLAS);
}
export function coinAtlasHTML(atlas,success,label) {
  const f=atlas.frames[success?'success.png':'failure.png'].frame;
  const image=encodeURI(atlas.image).replace(/["'()<>]/g,c=>'%'+c.charCodeAt(0).toString(16));
  const x=atlas.width===f.w?0:f.x/(atlas.width-f.w)*100,y=atlas.height===f.h?0:f.y/(atlas.height-f.h)*100;
  const safeLabel=String(label).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  return `<span class="vit-coin-atlas-face" role="img" aria-label="${safeLabel}" style="background-image:url(&quot;${image}&quot;);background-size:${atlas.width/f.w*100}% ${atlas.height/f.h*100}%;background-position:${x}% ${y}%"></span>`;
}
