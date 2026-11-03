import {t} from './rolls.mjs';
import {bloodPngFiles,bloodTileData} from './random-tile.mjs';
export const AUTO_BLOOD_SETTING='autoBlood';
export function autoBloodEnabled(){return game.settings?.get('vitruviy',AUTO_BLOOD_SETTING)===true;}
export function autoBloodMacroState(){const enabled=autoBloodEnabled();return {name:t(enabled?'AutoBloodMacroOn':'AutoBloodMacroOff'),img:enabled?'icons/svg/blood.svg':'icons/svg/cancel.svg'};}
export async function refreshAutoBloodMacro(){
 if(!game.user.isGM||game.users?.activeGM?.id!==game.user.id)return;
 const macro=game.macros?.find(entry=>entry.getFlag('vitruviy','libraryMacro')==='auto-blood');
 if(!macro)return;
 const state=autoBloodMacroState();if(macro.name!==state.name||macro.img!==state.img)await macro.update(state);
}
export function registerAutoBlood(){
 game.settings.register('vitruviy',AUTO_BLOOD_SETTING,{name:'VIT.AutoBlood',scope:'world',config:false,type:Boolean,default:false,onChange:()=>refreshAutoBloodMacro().catch(console.error)});
}
let toggling=false;
export async function toggleAutoBlood(){
 if(!game.user.isGM)throw Error(t('NoPermission'));
 if(toggling)return;
 toggling=true;
 try{
  const enabled=!autoBloodEnabled();await game.settings.set('vitruviy',AUTO_BLOOD_SETTING,enabled);
  ui.notifications.info(t(enabled?'AutoBloodEnabled':'AutoBloodDisabled'));
  return enabled;
 }finally{toggling=false;}
}
// Cosmetic only: callers catch failures after the committed HP update.
export async function maybeSpawnBlood(actor,{mode,amount,tokenUuids=[]}={}){
 if(!game.user.isGM||!autoBloodEnabled()||mode!=='damage'||!(amount>0))return [];
 const tokens=[];
 for(const uuid of new Set(tokenUuids)){
  const token=await fromUuid(uuid);
  if(token?.actor?.uuid===actor.uuid&&token.parent?.createEmbeddedDocuments)tokens.push(token);
 }
 if(!tokens.length)return [];
 const files=await bloodPngFiles(),groups=new Map();
 for(const token of tokens){
  const scene=token.parent,grid=Number(scene.grid?.size),point={x:Number(token.x)+Number(token.width)*grid/2,y:Number(token.y)+Number(token.height)*grid/2};
  const data=await bloodTileData(scene,point,{files});
  data.hidden=false;
  data.flags={vitruviy:{autoBlood:true,sourceTokenUuid:token.uuid}};
  if(!groups.has(scene))groups.set(scene,[]);groups.get(scene).push(data);
 }
 const created=[];
 for(const [scene,data]of groups){if(!autoBloodEnabled())return created;const tiles=await scene.createEmbeddedDocuments('Tile',data);if(tiles?.length!==data.length)throw Error(t('UpdateCancelled'));created.push(...tiles);}
 return created;
}
