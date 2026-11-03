import {effectiveModeItem} from './item-modes.mjs';
import {ATTRIBUTES} from './dice.mjs';
import {t,escape} from './rolls.mjs';
import {checkedUpdate} from './document-writes.mjs';
let queue=Promise.resolve();

export async function prepareItemEffect(item,targets=[...(game.user.targets??[])],options={}){
  if(!item.system.effectEnabled)return null;
  const target=item.system.effectTarget==='self'?item.actor:targets[0]?.actor;
  if(!target || (item.system.effectTarget!=='self'&&!targets.length))throw new Error(t('EffectSelectTarget'));
  if(!target.isOwner&&!game.users?.activeGM)throw new Error(t('EffectNeedsGM'));
  let attribute=item.system.effectAttribute??'choose';
  const bonus=Number(item.system.effectBonus??1);
  if(!Number.isSafeInteger(bonus)||!bonus||Math.abs(bonus)>6)throw new Error(t('InvalidCheck'));
  if(attribute==='choose'&&options.attribute!==undefined)attribute=options.attribute;
  if(attribute==='choose'){
    attribute=await foundry.applications.api.DialogV2.prompt({classes:['vitruviy','vit-dialog'],window:{title:item.name},
      content:`<p>${escape(target.name)}: ${bonus>0?'+':''}${bonus}</p><label>${t('Attribute')}<select name="attribute">${ATTRIBUTES.map(key=>`<option value="${key}">${t(key)}</option>`).join('')}</select></label>`,
      ok:{label:t('ConfirmEffect'),callback:(_event,button)=>button.form.elements.attribute.value},rejectClose:false});
    if(attribute===null)return false;
  }
  if(!ATTRIBUTES.includes(attribute))throw new Error(t('InvalidCheck'));
  return {sourceItemUuid:item.uuid,sourceActorUuid:item.actor.uuid,targetUuid:target.uuid,...(item.system.effectTarget!=='self'?{targetUuids:[...new Set(targets.map(token=>token.actor?.uuid).filter(Boolean))]}:{}),attribute,bonus,branch:item.system.effectBranch??'base',name:item.system.effectName||item.name,img:item.img};
}

export function effectData(effect,messageId){
  if(!ATTRIBUTES.includes(effect.attribute)||!Number.isSafeInteger(effect.bonus)||!effect.bonus||Math.abs(effect.bonus)>6)throw new Error(t('InvalidCheck'));
  if(!['base','attack','defense'].includes(effect.branch??'base'))throw Error(t('InvalidCheck'));
  const description=`<p>${escape(t(effect.attribute))}${effect.branch&&effect.branch!=='base'?' · '+escape(t(effect.branch==='attack'?'Attack':'Defense')):''}: ${effect.bonus>0?'+':''}${effect.bonus}</p>`;
  return {name:effect.name,img:effect.img,origin:effect.sourceItemUuid,disabled:false,
    description,
    system:{changes:[{key:`system.${effect.branch&&effect.branch!=='base'?`${effect.branch}Bonuses`:'attributes'}.${effect.attribute}`,type:'add',value:effect.bonus,phase:'initial',priority:20}]},
    flags:{vitruviy:{itemEffect:true,generatedDescription:description,sourceItemUuid:effect.sourceItemUuid,messageId}}};
}

export async function applyItemEffect(message,userId){
  const effect=message.getFlag('vitruviy','itemEffect');if(!effect)return;
  if(game.users.activeGM?game.users.activeGM.id!==game.user.id:game.user.id!==userId)return;
  const user=game.users.get(message.author?.id??userId),source=await fromUuid(effect.sourceActorUuid);
  if(!user || !source?.testUserPermission(user,'OWNER'))throw new Error(t('NoPermission'));
  let item=await fromUuid(effect.sourceItemUuid);const modeId=message.getFlag('vitruviy','item')?.modeId;if(modeId)item=effectiveModeItem(item,modeId);
  if(item?.actor?.uuid!==source.uuid || !item.system.effectEnabled)throw new Error(t('NoPermission'));
  for(const uuid of new Set(effect.targetUuids??[effect.targetUuid])){
    const target=await fromUuid(uuid);if(!target?.isOwner)throw Error(t('NoPermission'));
  if(target.getFlag('vitruviy',`itemEffectsApplied.${message.id}`))continue;
  const data=effectData(effect,message.id);
  // Reusing one source refreshes its bonus instead of multiplying it indefinitely.
  const existing=target.effects.find(entry=>entry.getFlag('vitruviy','sourceItemUuid')===effect.sourceItemUuid);
  if(existing?.getFlag('vitruviy','messageId')===message.id)continue;
  if(existing)await checkedUpdate(existing,data);
  else if(!(await target.createEmbeddedDocuments('ActiveEffect',[data]))?.length)throw new Error(t('UpdateCancelled'));
  await checkedUpdate(target,{[`flags.vitruviy.itemEffectsApplied.${message.id}`]:true});
  }
}

export function registerItemEffects(){
  Hooks.on('createChatMessage',(message,_options,userId)=>{
    queue=queue.catch(()=>{}).then(()=>applyItemEffect(message,userId)).catch(error=>{console.error(error);ui.notifications.error(error.message);});
  });
}

export function itemEffectViews(actor){
  return actor.effects.filter(effect=>!effect.disabled&&effect.getFlag('vitruviy','itemEffect')).map(effect=>({
    statusId:`wind-effect-${effect.id}`,effectId:effect.id,name:effect.name,img:effect.img,
    tooltip:`<strong>${escape(effect.name)}</strong>`
  }));
}
