import {updateActionRoll} from './action-dice.mjs';
import {inspirationReceipt} from './inspiration-chat.mjs';
import {refundInspiration} from './rolls.mjs';
import {actionModes,effectiveModeItem,chooseItemMode} from './item-modes.mjs';
import {areaSettings,selfAreaTokenUuid,validateSelfArea,createActivationArea} from './item-area.mjs';
import {confirmItemTargets} from './targets.mjs';
import {randomId} from './random-id.mjs';
import {prepareItemEffect,applyItemEffect} from './item-effects.mjs';
import {chargePlan,withItemCharges,refundItemChargesNow,chargesReturned} from './charges.mjs';
import {itemTextHTML} from './item-text.mjs';
import {rollAttribute, checkHTML, escape, t} from './rolls.mjs';
import {tierModifier, damageForSuccesses} from './tiers.mjs';
import {checkedUpdate} from './document-writes.mjs';
import {resourceOperation,registerResourceAction} from './operations.mjs';
const pending = new Set();

// v0.3: activation only publishes a declaration. Dice, costs and effects are explicit chat actions.
export function itemSnapshot(item){
 const system=item.system;
 return {uuid:item.uuid,modeId:item.windMode?.id,name:item.name,img:item.img,attribute:system.attribute,
  quantity:system.quantity,tier:system.tier,hasTier:system.hasTier!==false,modifier:tierModifier(system.tier),
  description:system.description,area:areaSettings(system),valueMode:item.windMode?.valueMode==='healing'?'healing':'damage',
  dealsDamage:false,targets:[]};
}
function assertOwner(item){if(!item?.isOwner||!item.actor?.isOwner)throw Error(t('NoPermission'));}
export async function resolveActionItem(message){
 if(!message?.visible||message.isContentVisible===false)throw Error(t('NoPermission'));
 const snapshot=message.getFlag('vitruviy','item');let item=await fromUuid(snapshot?.uuid);
 assertOwner(item);
 if(snapshot.modeId)item=effectiveModeItem(item,snapshot.modeId);
 return item;
}
export async function rollItem(item,options={}){
 assertOwner(item);
 if(pending.has(item.actor.uuid))return null;
 pending.add(item.actor.uuid);
 try{
  if(actionModes(item).length&&!options._modeApplied){
   const modeId=options.modeId??await chooseItemMode(item);if(!modeId)return null;
   item=effectiveModeItem(item,modeId);
  }
  const tokenUuid=areaSettings(item.system)?.placement==='self'?selfAreaTokenUuid(item.actor):undefined;
  return await resourceOperation(item.actor,'activateItem',{itemId:item.id,modeId:item.windMode?.id,tokenUuid,visibility:game.settings.get('core','messageMode')},()=>activateItem(item,game.user,game.settings.get('core','messageMode'),tokenUuid));
 }finally{pending.delete(item.actor.uuid);}
}
async function activateItem(item,user,visibility,tokenUuid){
 assertOwner(item);chargePlan(item);
 const actor=item.actor,cost=item.system.inspirationEnabled?Number(item.system.cost):0;
 if(!Number.isSafeInteger(cost)||cost<0)throw Error(t('InvalidCheck'));
 if(cost>actor.system.inspiration.value)throw Error(t('NotEnoughInspiration'));
 const before=actor.system.inspiration.value,useId=randomId(),snapshot=itemSnapshot(item);
 if(snapshot.area?.placement==='self')await validateSelfArea(item.actor,tokenUuid,user);
 const description=await itemTextHTML(snapshot.description,item);
 if(cost)await checkedUpdate(actor,{'system.inspiration.value':before-cost,[`flags.vitruviy.resourceUses.${useId}`]:true},{vitruviyResourceUseId:useId,vitruviyItemMessageId:useId});
 try{return await withItemCharges(item,async(uses,chargeUseId,quantity,customResource)=>{
  const parts=[...uses.map(use=>`${t('Charges')} - ${escape(use.name)}: ${use.cost<0?'+':'-'}${Math.abs(use.cost)}`),...(quantity?[`${t('Quantity')} - ${escape(quantity.name)}: -${quantity.cost}`]:[]),...(customResource&&!customResource.poolId?[`${escape(customResource.name)}: -${customResource.cost}`]:[])];
  const receipt=(cost?inspirationReceipt(actor,{kind:'spend',amount:cost,before,after:before-cost,userId:user.id}):'')+(parts.length?`<p class="vit-charge-receipt">${parts.join('; ')}</p>`:'');
  const flags={actionCard:true,activationResources:true,activationReceipt:receipt,item:snapshot,
   ...(cost?{resource:{actorUuid:actor.uuid,cost,useId,refundOnly:true}}:{}),
   ...(uses.length||quantity||customResource?{chargeUse:{actorUuid:actor.uuid,useId:chargeUseId,uses,quantity,customResource}}:{})};
  const message={author:user.id,speaker:ChatMessage.getSpeaker({actor}),content:`<article class="vit-chat vit-action-card"><header><img class="vit-chat-item-icon" src="${escape(snapshot.img??'icons/svg/item-bag.svg')}" alt="">${escape(snapshot.name)}</header><div class="vit-public-description vit-item-rich">${description}</div><p class="vit-hint">${t('ActionDeclarationHint')}</p>${receipt}</article>`,flags:{vitruviy:flags}};
  ChatMessage.applyMode(message,visibility);
  const created=await ChatMessage.create(message);if(!created)throw Error(t('UpdateCancelled'));
  if(snapshot.area?.placement==='self')try{await createActivationArea(item.actor,created,tokenUuid,user);}catch(error){try{await created.delete();}catch(cleanupError){console.error(cleanupError);ui.notifications.error(t('ResourceRollbackFailed'));}throw error;}
  return created;
 });}catch(error){
  if(cost)try{await refundInspiration(actor,actor.system.inspiration.value+cost,{[`flags.vitruviy.resourceUses.${useId}`]:false},{vitruviyInspirationSilent:true});}catch(rollbackError){console.error(rollbackError);ui.notifications.error(t('ResourceRollbackFailed'));}
  throw error;
 }
}
registerResourceAction('activateItem',async(actor,payload,user)=>{
 let item=actor.items.get(payload.itemId);assertOwner(item);
 if(payload.modeId)item=effectiveModeItem(item,payload.modeId);
 else if(actionModes(item).length)throw Error(t('AMmissing'));
 if(!['public','gm','blind','self','publicroll','gmroll','blindroll','selfroll'].includes(payload.visibility))throw Error(t('InvalidCheck'));
 return activateItem(item,user,payload.visibility,payload.tokenUuid);
});
const actionPending=new Set();
async function locked(message,kind,callback){
 const key=`${message.uuid??message.id}:${kind}`;if(actionPending.has(key))return null;
 actionPending.add(key);try{return await callback();}finally{actionPending.delete(key);}
}
export async function rollActionCard(message,options={}){
 return locked(message,'roll',async()=>{
  const item=await resolveActionItem(message);if(!item.system.rollEnabled)throw Error(t('InvalidCheck'));
  const result=await rollAttribute(item.actor,item.system.attribute,{...options,chatMessage:false,spend:0,
   inspirationEnabled:false,branch:item.system.rollBranch??'attack',
   mode:options.mode??(item.windMode?.defaultMode==='inherit'?undefined:item.windMode?.defaultMode)});
  if(!result)return null;
  const snapshot=itemSnapshot(item);
  snapshot.targets=message.getFlag('vitruviy','item')?.targets?.length?message.getFlag('vitruviy','item').targets:[...(game.user.targets??[])].filter(token=>token.actor&&token.document?.uuid).map(token=>({uuid:token.document.uuid,name:token.name,actorUuid:token.actor.uuid}));
  snapshot.dealsDamage=item.system.dealsDamage===true;
  const damage=snapshot.dealsDamage?damageForSuccesses(result.total,snapshot.tier):null;
  snapshot.potentialDamage=damage;
  const descriptionHTML=await itemTextHTML(snapshot.description,item);
  const {rolls=[],...check}=result;
  const data={rolls,
   content:checkHTML(result,item.name,'',{descriptionHTML,damage,modifier:snapshot.modifier,tier:snapshot.tier,hasTier:snapshot.hasTier,img:item.img,quantity:snapshot.quantity}),
   'flags.vitruviy.actionResult':true,'flags.vitruviy.item':snapshot,'flags.vitruviy.check':{...check,attribute:item.system.attribute}};
  data.content=data.content.replace('</article>',`${message.getFlag('vitruviy','activationReceipt')??''}${message.getFlag('vitruviy','effectReceipt')??''}${message.getFlag('vitruviy','areaReceipt')??''}${message.getFlag('vitruviy','activationRefunded')?`<p>${t('ActionResourcesReturned')}</p>`:''}</article>`);
  ChatMessage.applyMode(data,result.messageMode);
  await updateActionRoll(message,data);
  return {...result,potentialDamage:damage};
 });
}
export function actionResourcesReturned(message,actor){
 const resource=message.getFlag('vitruviy','resource'),charges=message.getFlag('vitruviy','chargeUse');
 return (!resource||!actor.getFlag('vitruviy',`resourceUses.${resource.useId??message.id}`))&&(!charges||chargesReturned(actor,charges));
}
export async function refundActionResources(message){
 return locked(message,'refund',async()=>{
  const item=await resolveActionItem(message);
  return resourceOperation(item.actor,'refundActivation',{messageUuid:message.uuid},()=>refundActivationNow(item.actor,message));
 });
}
async function refundActivationNow(actor,message){
 if(!message.getFlag('vitruviy','activationResources'))throw Error(t('NoPermission'));
 if(actionResourcesReturned(message,actor))return false;
 const resource=message.getFlag('vitruviy','resource'),charges=message.getFlag('vitruviy','chargeUse');
 if(charges)await refundItemChargesNow(message,{repeat:false});
 if(resource&&actor.getFlag('vitruviy',`resourceUses.${resource.useId??message.id}`)){
  const value=actor.system.inspiration.value+resource.cost;
  if(!Number.isSafeInteger(value)||!Number.isSafeInteger(resource.cost)||resource.cost<1)throw Error(t('InvalidCheck'));
  await refundInspiration(actor,value,{[`flags.vitruviy.resourceUses.${resource.useId??message.id}`]:false},{vitruviyInspirationSilent:true});
 }
 await checkedUpdate(message,{'flags.vitruviy.activationRefunded':true,content:message.content.replace('</article>',`<p>${t('ActionResourcesReturned')}</p></article>`)});
 return true;
}
registerResourceAction('refundActivation',async(actor,payload,user)=>{
 const message=await fromUuid(payload.messageUuid),item=await resolveActionItem(message);
 if(item.actor.uuid!==actor.uuid||!actor.testUserPermission(user,'OWNER'))throw Error(t('NoPermission'));
 return refundActivationNow(actor,message);
});
export async function applyActionEffect(message){
 if(!game.user.isGM)throw Error(t('NoPermission'));
 return locked(message,'effect',async()=>{
  const item=await resolveActionItem(message);
  const targets=item.system.effectTarget==='self'?[]:await confirmItemTargets(item);
  if(targets===null)return null;
  const effect=await prepareItemEffect(item,targets);if(!effect)return null;
  await checkedUpdate(message,{'flags.vitruviy.itemEffect':effect});
  await applyItemEffect(message,game.user.id);
  const receipt=`<p class="vit-applied-effect">${t('ApplyConfiguredEffect')}: ${escape(effect.name)} (${escape(t(effect.attribute))} ${effect.bonus>0?'+':''}${effect.bonus})</p>`;
  await checkedUpdate(message,{'flags.vitruviy.effectReceipt':receipt,content:message.content.replace(/<p class="vit-applied-effect">[\s\S]*?<\/p>/g,'').replace('</article>',`${receipt}</article>`)});
  return true;
 });
}
export async function assignActionTargets(message){
 if(!game.user.isGM)throw Error(t('NoPermission'));
 const item=await resolveActionItem(message),targets=await confirmItemTargets(item);if(targets===null)return null;
 return checkedUpdate(message,{'flags.vitruviy.item.targets':targets.map(token=>({uuid:token.document.uuid,name:token.name,actorUuid:token.actor.uuid}))});
}
export async function addActionControls(message,html){
 if(!message.visible||message.isContentVisible===false||!message.getFlag('vitruviy','actionCard'))return;
 const card=html.querySelector('.vit-chat');if(!card||card.querySelector('.vit-action-controls'))return;
 let item;try{item=await resolveActionItem(message);}catch{return;}
 const controls=document.createElement('div');controls.className='vit-action-controls';
 const button=(label,action)=>{const b=document.createElement('button');b.type='button';b.textContent=label;
  b.addEventListener('click',async()=>{b.disabled=true;try{await action();}catch(error){ui.notifications.error(error.message);}finally{b.disabled=false;}});controls.append(b);};
 if(message.getFlag('vitruviy','actionCard')){
  if(item.system.rollEnabled)button(t('Roll'),()=>rollActionCard(message));
  if(message.getFlag('vitruviy','activationResources')&&(message.getFlag('vitruviy','resource')||message.getFlag('vitruviy','chargeUse'))){
   const returned=actionResourcesReturned(message,item.actor);button(t(returned?'ActionResourcesReturned':'RefundActionResources'),()=>refundActionResources(message));controls.lastElementChild.disabled=returned;
  }
  if(item.system.effectEnabled&&game.user.isGM)button(t('ApplyConfiguredEffect'),()=>applyActionEffect(message));
 }
 const targetSection=card.querySelector('.vit-chat-targets');
 if(targetSection)card.insertBefore(controls,targetSection);else card.append(controls);
}
