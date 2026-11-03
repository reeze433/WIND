import {ATTRIBUTES} from './dice.mjs';
import {t,escape} from './rolls.mjs';
import {randomId} from './random-id.mjs';
import {resourceDefinitions} from './resource-state.mjs';
const W=key=>game.i18n.localize(`VIT.AM${key}`);
const choices={attribute:ATTRIBUTES,rollBranch:['base','attack','defense'],tier:['S','A','B','C','D','E'],quantityUsage:['auto','none','consume'],effectTarget:['self','target'],effectAttribute:['choose',...ATTRIBUTES],effectBranch:['base','attack','defense'],areaPlacement:['point','self'],areaShape:['circle','cone','line','rectangle']};
export const modeFields=[
 ['rollEnabled','bool','roll'],['attribute','enum','roll'],['rollBranch','enum','roll'],['dealsDamage','bool','roll'],['hasTier','bool','roll'],['tier','enum','roll'],
 ['inspirationEnabled','bool','resources'],['cost','number','resources',0,100000],['chargesEnabled','bool','resources'],['chargeCost','number','resources',1,100000],['chargeSourceId','item','resources'],['sourceChargeCost','number','resources',1,100000],['chargeReceiverId','item','resources'],['restoreChargeAmount','number','resources',1,100000],['chargeRestoreFull','bool','resources'],['quantityUsage','enum','resources'],['quantityCost','number','resources',1,100000],['customResourceId','resource','resources'],['customResourceCost','number','resources',1,100000],
 ['effectEnabled','bool','effects'],['effectName','text','effects'],['effectTarget','enum','effects'],['effectAttribute','enum','effects'],['effectBranch','enum','effects'],['effectBonus','number','effects',-6,6],
 ['areaEnabled','bool','area'],['areaPlacement','enum','area'],['areaShape','enum','area'],['areaSize','number','area',.1,1000],['areaWidth','number','area',.1,1000],['areaAngle','number','area',1,360]
];
const fields=new Map(modeFields.map(field=>[field[0],field]));
export function normalizeActionMode(value){
 if(!value||typeof value!=='object'||typeof value.id!=='string'||!/^[a-zA-Z0-9-]{1,64}$/.test(value.id)||typeof value.name!=='string'||!value.name.trim()||value.name.trim().length>80)throw Error(W('invalid'));
 const overrides={};for(const [key,v]of Object.entries(value.overrides??{})){
  const field=fields.get(key);if(!field)throw Error(W('invalid'));const [,type,,min,max]=field;
  if(type==='bool'&&typeof v!=='boolean'||type==='number'&&(!Number.isFinite(v)||v<min||v>max||!['areaSize','areaWidth','areaAngle'].includes(key)&&!Number.isSafeInteger(v))||type==='enum'&&!choices[key].includes(v)||['text','item','resource'].includes(type)&&(typeof v!=='string'||v.length>200))throw Error(W('invalid'));
  overrides[key]=v;
 }
 const defaultMode=value.defaultMode??'inherit',valueMode=value.valueMode??'inherit',behavior=value.behavior??'standard';
 if(!['inherit','normal','advantage','disadvantage'].includes(defaultMode)||!['inherit','damage','healing'].includes(valueMode)||!['standard','ranged','melee'].includes(behavior))throw Error(W('invalid'));
 return {id:value.id,name:value.name.trim(),description:String(value.description??'').slice(0,2000),defaultMode,valueMode,behavior:'standard',overrides};
}
export function actionModes(item){const list=item.system.actionModes??[];if(!Array.isArray(list)||list.length>16)throw Error(W('invalid'));const modes=list.map(normalizeActionMode);if(new Set(modes.map(m=>m.id)).size!==modes.length)throw Error(W('invalid'));return modes;}
export function effectiveModeItem(item,id){
 const mode=actionModes(item).find(m=>m.id===id);if(!mode)throw Error(W('missing'));
 const patch={name:`${item.name} / ${mode.name}`,system:mode.overrides};
 const clone=item.clone?item.clone(patch,{keepId:true}):{...item,...patch,system:{...item.system,...mode.overrides}};
 Object.defineProperty(clone,'windMode',{value:mode,configurable:true});return clone;
}
const selections=new Set();
export async function chooseItemMode(item){
 const modes=actionModes(item);if(!modes.length)return null;if(modes.length===1)return modes[0].id;const key=item.actor?.uuid??item.uuid;if(selections.has(key))return null;selections.add(key);
 try{return await foundry.applications.api.DialogV2.prompt({classes:['vitruviy','vit-dialog'],window:{title:item.name},content:`<div class="vit-roll-form"><label>${W('select')}<select name="modeId">${modes.map(m=>`<option value="${m.id}">${escape(m.name)}</option>`).join('')}</select></label>${modes.map(m=>`<p><strong>${escape(m.name)}</strong>${m.description?': '+escape(m.description):''}</p>`).join('')}</div>`,ok:{label:t('UseItem'),callback:(_e,b)=>b.form.elements.modeId.value},rejectClose:false});}finally{selections.delete(key);}
}
export function modeViews(item){return actionModes(item).map(mode=>({...mode,summary:Object.entries(mode.overrides).map(([key,value])=>`${W(key)}: ${typeof value==='boolean'?W(value?'yes':'no'):fields.get(key)?.[1]==='enum'?enumName(key,value):value===''?W('none'):value}`).join('; ')||W('inherited')}));}
function enumName(key,value){if(key==='areaPlacement')return t(`AreaPlacement_${value}`);if(ATTRIBUTES.includes(value))return t(value);if(key==='tier')return value;if(['rollBranch','effectBranch'].includes(key))return t(value==='base'?'BaseAttribute':value==='attack'?'Attack':'Defense');return W('choice_'+value);}
function fieldHTML(item,mode,field){
 const [key,type,,min,max]=field,value=mode.overrides[key];let input;
 if(type==='number'||type==='text')input=`<input name="ov_${key}" type="${type==='number'?'number':'text'}" value="${escape(value??'')}" placeholder="${W('inherited')}" ${type==='number'?`min="${min}" max="${max}" step="${['areaSize','areaWidth','areaAngle'].includes(key)?'0.1':'1'}"`:''}>`;
 else{let options;if(type==='bool')options=[['true',W('yes')],['false',W('no')]];
 else if(type==='enum')options=choices[key].map(v=>[v,enumName(key,v)]);
 else options=[['@none',W('none')],...(type==='item'?[...(item.actor?.items??[])].filter(i=>i.system.chargesEnabled&&i.id!==item.id).map(i=>[i.id,i.name]):resourceDefinitions().map(r=>[r.id,r.name]))];
 const selected=value===undefined?'@inherit':value===''?'@none':String(value);if(!['@inherit',...options.map(([v])=>v)].includes(selected))options.push([selected,W('unavailable')]);
 input=`<select name="ov_${key}"><option value="@inherit">${W('inherited')}</option>${options.map(([v,label])=>`<option value="${escape(v)}" ${v===selected?'selected':''}>${escape(label)}</option>`).join('')}</select>`;}
 return `<label>${W(key)}${input}</label>`;
}
export async function editActionMode(item,id){
 if(!item.isOwner)throw Error(t('NoPermission'));const modes=actionModes(item),old=modes.find(m=>m.id===id),mode=old??{id:randomId(),name:W('new')+' '+(modes.length+1),overrides:{},defaultMode:'inherit',valueMode:'inherit',behavior:'standard'};
 if(!old&&modes.length>=16)throw Error(W('limit'));
 const select=(name,options,current)=>`<select name="${name}">${options.map(([v,label])=>`<option value="${v}" ${v===current?'selected':''}>${escape(label)}</option>`).join('')}</select>`;
 const values=await foundry.applications.api.DialogV2.prompt({classes:['vitruviy','vit-dialog','vit-mode-editor'],window:{title:W(old?'edit':'add')},content:`<div class="vit-roll-form"><p class="vit-hint">${W('help')}</p><label>${W('name')}<input name="name" value="${escape(mode.name)}" maxlength="80" required></label><label>${W('description')}<textarea name="description" rows="2">${escape(mode.description??'')}</textarea></label><label>${t('Mode')}${select('defaultMode',[['inherit',W('inherited')],...['normal','advantage','disadvantage'].map(v=>[v,t(v)])],mode.defaultMode)}</label><label>${W('valueMode')}${select('valueMode',[['inherit',W('inherited')],['damage',t('Damage')],['healing',t('Healing')]],mode.valueMode)}</label>${['roll','resources','effects','area'].map(group=>`<details ${group==='roll'?'open':''}><summary>${W(group)}</summary><p class="vit-hint">${W(group+'Help')}</p>${modeFields.filter(f=>f[2]===group).map(f=>fieldHTML(item,mode,f)).join('')}</details>`).join('')}</div>`,ok:{label:t('Save'),callback:(_e,b)=>{
 const data=Object.fromEntries(new FormData(b.form)),overrides={};for(const [key,type]of modeFields){const value=data['ov_'+key];if(value===undefined||value===''||value==='@inherit')continue;overrides[key]=type==='bool'?value==='true':type==='number'?Number(value):value==='@none'?'':value;}
 return normalizeActionMode({id:mode.id,name:data.name,description:data.description,defaultMode:data.defaultMode,valueMode:data.valueMode,behavior:data.behavior??'standard',overrides});}},rejectClose:false});
 if(!values)return;if(!item.isOwner)throw Error(t('NoPermission'));const latest=actionModes(item),index=latest.findIndex(m=>m.id===mode.id);if(old&&index<0)throw Error(W('missing'));if(index<0)latest.push(values);else latest[index]=values;
 await item.update({'system.actionModes':latest});
}
export async function deleteActionMode(item,id){if(!item.isOwner)throw Error(t('NoPermission'));const modes=actionModes(item),mode=modes.find(m=>m.id===id);if(!mode)return;if(await foundry.applications.api.DialogV2.confirm({classes:['vitruviy','vit-dialog'],window:{title:W('delete')},content:`<p>${escape(mode.name)}</p>`}))await item.update({'system.actionModes':actionModes(item).filter(m=>m.id!==id)});}

