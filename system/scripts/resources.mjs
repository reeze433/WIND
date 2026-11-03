import {inspirationReceipt,inspirationText} from './inspiration-chat.mjs';
import {randomId} from './random-id.mjs';
import {checkedUpdate} from './document-writes.mjs';
import {resourceOperation,registerResourceAction} from './operations.mjs';
import {t, escape, refundInspiration} from './rolls.mjs';
const pending = new Set();
export async function spendInspiration(actor) {
  actor ??= canvas.tokens?.controlled?.[0]?.actor ?? game.user.character;
  if (!actor?.isOwner) throw new Error(t('NoPermission'));
  const visibility={};ChatMessage.applyMode(visibility);
  return resourceOperation(actor,'spendInspiration',{visibility},()=>spendInspirationNow(actor,visibility));
}
registerResourceAction('spendInspiration',(actor,payload,user)=>spendInspirationNow(actor,payload.visibility,user));
async function spendInspirationNow(actor,visibility={},user=game.user){
  if (pending.has(actor.uuid)) return;
  pending.add(actor.uuid);
  try {
    if (actor.system.inspiration.value < 1) throw new Error(t('NotEnoughInspiration'));
    const useId=randomId();
    await checkedUpdate(actor,{'system.inspiration.value':actor.system.inspiration.value-1,[`flags.vitruviy.resourceUses.${useId}`]:true},{vitruviyResourceUseId:useId,vitruviyItemMessageId:useId});
    try{
      const message={speaker:ChatMessage.getSpeaker({actor}),author:user.id,whisper:visibility.whisper??[],blind:visibility.blind===true,
        content:`<article class="vit-chat"><p>${inspirationText(actor,{kind:"spend",amount:1,before:actor.system.inspiration.value+1,after:actor.system.inspiration.value,userId:user.id})}</p></article>`,
        flags:{vitruviy:{resource:{actorUuid:actor.uuid,cost:1,useId,refundOnly:true}}}};
      if(!await ChatMessage.create(message))throw new Error(t('UpdateCancelled'));
    }catch(error){await refundInspiration(actor,actor.system.inspiration.value+1,{[`flags.vitruviy.resourceUses.${useId}`]:false},{vitruviyInspirationSilent:true});throw error;}
  } finally {pending.delete(actor.uuid);}
}
const inspirationUIBusy=new Set();
const inspirationKey=message=>message.uuid??message.id;
export async function toggleItemInspiration(message,{repeatRefund=false}={}) {
  const resource = message?.getFlag('vitruviy','resource');
  if (!resource || !message.visible) throw new Error(t('NoPermission'));
  const actor = await fromUuid(resource.actorUuid);
  if (!actor?.isOwner || !Number.isSafeInteger(resource.cost) || resource.cost <= 0) throw new Error(t('NoPermission'));
  const key=inspirationKey(message);if(inspirationUIBusy.has(key))return;inspirationUIBusy.add(key);
  try{return await resourceOperation(actor,'toggleInspiration',{messageUuid:message.uuid,repeatRefund},()=>toggleItemInspirationNow(message,actor,resource,{repeatRefund}));}finally{inspirationUIBusy.delete(key);}
}
registerResourceAction('toggleInspiration',async(actor,payload)=>{
  const message=await fromUuid(payload.messageUuid),resource=message?.getFlag('vitruviy','resource');
  if(resource?.actorUuid!==actor.uuid||!Number.isSafeInteger(resource.cost)||resource.cost<=0)throw new Error(t('NoPermission'));
  return toggleItemInspirationNow(message,actor,resource,{repeatRefund:payload.repeatRefund===true});
});
async function toggleItemInspirationNow(message,actor,resource,{repeatRefund=false}={}){
  if (pending.has(actor.uuid)) return;
  pending.add(actor.uuid);
  try {
    const useId=resource.useId??message.id;
    const spent = !!actor.getFlag('vitruviy',`resourceUses.${useId}`);
    if(resource.refundOnly&&!spent){ui.notifications.warn(t('InspirationAlreadyReturned'));return false;}
    const balance = actor.system.inspiration.value;
    const refund=spent;
    if(refund&&!Number.isSafeInteger(balance+resource.cost))throw Error(t('InvalidCheck'));
    if (!refund && balance < resource.cost) throw new Error(t('NotEnoughInspiration'));
    const changes = {[`flags.vitruviy.resourceUses.${useId}`]: !refund};
    if (refund) await refundInspiration(actor, balance + resource.cost, changes);
    else await checkedUpdate(actor,{...changes, 'system.inspiration.value': balance - resource.cost},{vitruviyResourceUseId:useId});
    return !refund;
  } finally {pending.delete(actor.uuid);}
}
export async function addResourceControls(message, html) {
  if(message.getFlag('vitruviy','activationResources')===true)return;
  const resource = message.getFlag('vitruviy','resource');
  if (!resource || !message.visible) return;
  const actor = await fromUuid(resource.actorUuid);
  if (!actor?.isOwner) return;
  const card = html.querySelector('.vit-chat');
  if (!card || card.querySelector('.vit-resource-toggle')) return;
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'vit-resource-toggle';
  button.title=t('InspirationRefundScope');
  button.dataset.messageId=message.id;button.dataset.actorUuid=actor.uuid;
  let status;
  if(!resource.refundOnly){status=document.createElement('p');status.className='vit-resource-status';status.dataset.messageId=message.id;card.append(status);}
  const refresh=()=>{const spent=actor.getFlag('vitruviy',`resourceUses.${resource.useId??message.id}`);button.textContent=`${t(resource.refundOnly||spent?'Refund':message.getFlag('vitruviy','actionCard')?'SpendActionInspiration':'Spend')} (${resource.cost})`;button.disabled=inspirationUIBusy.has(inspirationKey(message))||(resource.refundOnly===true&&!spent);if(resource.refundOnly&&!spent)button.textContent=t('InspirationAlreadyReturned');if(status){status.hidden=!!card.querySelector('.vit-inspiration-event');status.textContent=`${t(spent?'ItemInspirationSpent':'ItemInspirationNotSpent')}: ${resource.cost}`;}};
  refresh();
  button.addEventListener('click',async()=>{
    button.disabled=true;
    try {await toggleItemInspiration(message,{repeatRefund:resource.refundOnly===true});}catch(error){ui.notifications.error(error.message);}finally{button.disabled=false;refresh();}
  });
  card.append(button);
}
export function refreshResourceControls(actor) {
  for(const button of document.querySelectorAll('.vit-resource-toggle')) {
    if(button.dataset.actorUuid!==actor.uuid)continue;
    const message=game.messages.get(button.dataset.messageId),resource=message?.getFlag('vitruviy','resource');
    if(resource){const spent=actor.getFlag('vitruviy',`resourceUses.${resource.useId??message.id}`);button.textContent=`${t(resource.refundOnly||spent?'Refund':message.getFlag('vitruviy','actionCard')?'SpendActionInspiration':'Spend')} (${resource.cost})`;button.disabled=inspirationUIBusy.has(inspirationKey(message))||(resource.refundOnly===true&&!spent);if(resource.refundOnly&&!spent)button.textContent=t('InspirationAlreadyReturned');const card=button.closest('.vit-chat'),status=card?.querySelector('.vit-resource-status');if(status){status.hidden=!!card.querySelector('.vit-inspiration-event');status.textContent=`${t(spent?'ItemInspirationSpent':'ItemInspirationNotSpent')}: ${resource.cost}`;}}
  }
}


