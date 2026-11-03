import {randomId} from './random-id.mjs';
import {chargeFormulaError} from './charge-formula.mjs';
import {resourceOperation,registerResourceAction} from './operations.mjs';
import {checkedUpdate,checkedEmbeddedUpdate} from './document-writes.mjs';
import {customSpendPlan,withCustomResourceSpend,customRefundUpdates} from './resource-spending.mjs';
import {t} from './rolls.mjs';
const pending=new Set();

export function quantityPlan(item){
  const mode=item.system.quantityUsage??'auto';
  if(!['auto','none','consume'].includes(mode))throw new Error(t('InvalidCheck'));
  const consume=mode==='consume'||(mode==='auto'&&item.system.chargeReceiverId&&!item.system.chargesEnabled&&!item.system.chargeSourceId);
  if(!consume)return null;
  const cost=item.system.quantityCost??1,value=item.system.quantity;
  if(!item.isOwner||!item.actor?.isOwner)throw new Error(t('NoPermission'));
  if(!Number.isSafeInteger(cost)||cost<1||!Number.isSafeInteger(value)||value<cost)throw new Error(t('NotEnoughQuantity'));
  return {id:item.id,name:item.name,cost};
}

function mergeUpdates(updates){
  const result=new Map();
  for(const update of updates)result.set(update._id,{...result.get(update._id),...update});
  return [...result.values()];
}

export function validateChargeReceiver(item,receiver){
  if(!receiver)throw new Error(t('ChargeReceiverMissing'));
  if(!item.actor?.isOwner || !item.isOwner || !receiver.isOwner || receiver.actor?.uuid!==item.actor.uuid)throw new Error(t('ChargeSourceSameActor'));
  if(!receiver.system.chargesEnabled)throw new Error(t('ChargeReceiverNeedsPool'));
  return receiver;
}

export function validateChargeSource(item,source) {
  if(!source)throw new Error(t('ChargeSourceMissing'));
  if(!item?.actor || !item.isOwner || !item.actor.isOwner || !source?.isOwner || source.actor?.uuid!==item.actor.uuid)
    throw new Error(t('ChargeSourceSameActor'));
  if(!source.system.chargesEnabled)throw new Error(t('ChargeSourceNeedsPool'));
  const seen=new Set([item.id]);
  for(let current=source;current;current=item.actor.items.get(current.system.chargeSourceId)){
    if(seen.has(current.id))throw new Error(t('ChargeCycle'));
    seen.add(current.id);
    if(!current.system.chargeSourceId)break;
  }
  return source;
}

export function chargePlan(item) {
  const custom=customSpendPlan(item);
  quantityPlan(item);
  return buildChargePlan(item,custom);
}
function buildChargePlan(item,custom) {
  const system=item.system;
  if(!system.chargesEnabled && !system.chargeSourceId && !system.chargeReceiverId&&!custom?.poolId)return [];
  if(!item.isOwner || !item.actor?.isOwner)throw new Error(t('NoPermission'));
  const plan=[];
  if(system.chargesEnabled)plan.push({item,cost:system.chargeCost??1});
  if(system.chargeSourceId){
    const source=validateChargeSource(item,item.actor.items.get(system.chargeSourceId));
    plan.push({item:source,cost:system.sourceChargeCost??1});
  }
  if(custom?.poolId)plan.push({item:item.actor.items.get(custom.poolId),cost:custom.cost});
  const merged=new Map();
  for(const entry of plan){const previous=merged.get(entry.item.id);if(previous)previous.cost+=entry.cost;else merged.set(entry.item.id,entry);}
  plan.splice(0,plan.length,...merged.values());
  for(const entry of plan){
    if(chargeFormulaError(entry.item))throw new Error(t('InvalidChargeFormula'));
    const {value,max}=entry.item.system.charges??{};
    if(!Number.isSafeInteger(entry.cost)||entry.cost<1 || !Number.isSafeInteger(value)||!Number.isSafeInteger(max)||value<0||value>max)
      throw new Error(t('InvalidCharges'));
    if(value<entry.cost)throw new Error(`${entry.item.name}: ${t('NotEnoughCharges')}`);
  }
  if(system.chargeReceiverId){
    const receiver=validateChargeReceiver(item,item.actor.items.get(system.chargeReceiverId));
    if(chargeFormulaError(receiver))throw new Error(t('InvalidChargeFormula'));
    const {value,max}=receiver.system.charges??{};
    const amount=system.restoreChargeAmount??1;
    if(!Number.isSafeInteger(value)||!Number.isSafeInteger(max)||value<0||max<value||!Number.isSafeInteger(amount)||amount<1)throw new Error(t('InvalidCharges'));
    const debit=plan.find(entry=>entry.item.id===receiver.id);
    const available=max-value+(debit?.cost??0);
    if(!available)throw new Error(t('ChargeReceiverFull'));
    const restored=system.chargeRestoreFull?available:Math.min(amount,available);
    if(debit)debit.cost-=restored;else plan.push({item:receiver,cost:-restored});
  }
  return plan.filter(entry=>entry.cost!==0);
}

// Debit all pools in one embedded update. Failed message creation restores only the spent charges.
export async function withItemCharges(item,createMessage) {
  const key=item.actor?.uuid;
  if(pending.has(key))throw new Error(t('ChargeUsePending'));
  pending.add(key);
  try{
    const quantity=quantityPlan(item),custom=customSpendPlan(item);
    const plan=buildChargePlan(item,custom);
    if(!plan.length&&!quantity&&!custom)return await createMessage([]);
    const useId=randomId();
    const updates=plan.map(entry=>({_id:entry.item.id,'system.charges.value':entry.item.system.charges.value-entry.cost,
      [`flags.vitruviy.chargeUses.${useId}`]:{cost:entry.cost,refunded:false}}));
    if(quantity)updates.push({_id:item.id,'system.quantity':item.system.quantity-quantity.cost,[`flags.vitruviy.quantityUses.${useId}`]:{cost:quantity.cost,refunded:false}});
    return await withCustomResourceSpend(item,useId,async customResource=>{
    try{if(updates.length)await checkedEmbeddedUpdate(item.actor,'Item',mergeUpdates(updates));
      return await createMessage(plan.map(entry=>({id:entry.item.id,name:entry.item.name,cost:entry.cost})),useId,quantity,customResource);}
    catch(error){
      try{
        const refunds=plan.flatMap(entry=>{
          const current=item.actor.items.get(entry.item.id);
          return current?.getFlag('vitruviy',`chargeUses.${useId}`)?.refunded===false?[{_id:current.id,'system.charges.value':Math.max(0,Math.min(current.system.charges.max,current.system.charges.value+entry.cost)),
            [`flags.vitruviy.chargeUses.${useId}`]:{cost:entry.cost,refunded:true}}]:[];
        });
        if(quantity){const current=item.actor.items.get(quantity.id);if(current?.getFlag('vitruviy',`quantityUses.${useId}`)?.refunded===false)refunds.push({_id:current.id,'system.quantity':current.system.quantity+quantity.cost,[`flags.vitruviy.quantityUses.${useId}`]:{cost:quantity.cost,refunded:true}});}
        if(refunds.length)await checkedEmbeddedUpdate(item.actor,'Item',mergeUpdates(refunds));
      }catch(refundError){ui.notifications.error(t('ChargeRefundFailed'));console.error(refundError);}
      throw error;
    }
    });
  }finally{pending.delete(key);}
}

function chargeReceipt(message){
  const receipt=message?.getFlag('vitruviy','chargeUse');
  if(receipt)return receipt;
  const uses=message?.getFlag('vitruviy','chargeUses'),uuid=message?.getFlag('vitruviy','item')?.uuid;
  const position=uuid?.lastIndexOf('.Item.')??-1;
  if(Array.isArray(uses)&&uses.length&&position>0&&message.id)
    return {actorUuid:uuid.slice(0,position),useId:`legacy-${message.id}`,uses,legacy:true};
}

const refundPending=new Set();
const refundKey=message=>message.uuid??message.id??chargeReceipt(message)?.useId;
export async function refundItemCharges(message,{repeat=false}={}){
  const receipt=chargeReceipt(message),actor=receipt?await fromUuid(receipt.actorUuid):null;
  if(!message?.visible||!actor?.isOwner)throw new Error(t('NoPermission'));
  const key=refundKey(message);if(refundPending.has(key))return;refundPending.add(key);
  try{return await resourceOperation(actor,'refundCharges',{messageUuid:message.uuid,repeat},()=>refundItemChargesNow(message,{repeat}));}finally{refundPending.delete(key);}
}
registerResourceAction('refundCharges',async(actor,payload)=>{
  const message=await fromUuid(payload.messageUuid);
  if(chargeReceipt(message)?.actorUuid!==actor.uuid)throw new Error(t('NoPermission'));
  return refundItemChargesNow(message,{repeat:payload.repeat===true});
});
export async function refundItemChargesNow(message,{repeat=false}={}){
  if(message.getFlag('vitruviy','activationResources')===true)repeat=false;
  const receipt=chargeReceipt(message);
  if(!receipt || !message.visible)throw new Error(t('NoPermission'));
  const actor=await fromUuid(receipt.actorUuid);
  if(!actor?.isOwner)throw new Error(t('NoPermission'));
  if(pending.has(actor.uuid))return;
  pending.add(actor.uuid);
  try{
    const customUpdates=receipt.customResource?customRefundUpdates(actor,receipt.customResource,receipt.useId,{repeat}):{};
    const updates=[];
    for(const use of receipt.uses){
      const item=actor.items.get(use.id);
      if(!item?.isOwner)throw new Error(t('ChargeSourceMissing'));
      const record=item.getFlag('vitruviy',`chargeUses.${receipt.useId}`)??(receipt.legacy?{cost:use.cost,refunded:false}:null);
      if(!record || record.cost!==use.cost || !Number.isSafeInteger(record.cost)||record.cost===0)throw new Error(t('InvalidCharges'));
      if(record.refunded&&!repeat)continue;
      const {value,max}=item.system.charges;
      if(!Number.isSafeInteger(value)||!Number.isSafeInteger(max)||value<0||max<value)throw new Error(t('InvalidCharges'));
      if(record.cost<0&&value+record.cost<0)throw new Error(t('ChargeRestorationSpent'));
      updates.push({_id:item.id,'system.charges.value':Math.min(max,value+record.cost),
        [`flags.vitruviy.chargeUses.${receipt.useId}`]:{...record,refunded:true}});
    }
    if(receipt.quantity){
      const use=receipt.quantity,item=actor.items.get(use.id),record=item?.getFlag('vitruviy',`quantityUses.${receipt.useId}`);
      if(!item?.isOwner||!record||record.cost!==use.cost||!Number.isSafeInteger(record.cost)||record.cost<1)throw new Error(t('InvalidCheck'));
      if(!record.refunded||repeat){
        const value=item.system.quantity+record.cost;if(!Number.isSafeInteger(value))throw new Error(t('InvalidCheck'));
        updates.push({_id:item.id,'system.quantity':value,[`flags.vitruviy.quantityUses.${receipt.useId}`]:{...record,refunded:true}});
      }
    }
    if(updates.length)await checkedEmbeddedUpdate(actor,'Item',mergeUpdates(updates));
    if(Object.keys(customUpdates).length)await checkedUpdate(actor,customUpdates);
    return true;
  }finally{pending.delete(actor.uuid);}
}

export function chargesReturned(actor,receipt){
  return receipt.uses.every(use=>actor.items.get(use.id)?.getFlag('vitruviy',`chargeUses.${receipt.useId}`)?.refunded)&&(!receipt.quantity||actor.items.get(receipt.quantity.id)?.getFlag('vitruviy',`quantityUses.${receipt.useId}`)?.refunded)&&(!receipt.customResource||actor.getFlag('vitruviy',`customResourceUses.${receipt.useId}`)?.refunded);
}

function refundLabel(receipt,returned){
  if(receipt.customResource)return t(returned?'CustomResourceReturned':'RefundCustomResource');
  if(receipt.quantity)return t(returned?'ItemConsumptionUndone':'UndoItemConsumption');
  if(receipt.uses.some(use=>use.cost<0))return t(returned?'ChargeChangesUndone':'UndoChargeChanges');
  return `${t(returned?'ChargesReturned':'RefundCharges')} (${receipt.uses.reduce((sum,use)=>sum+use.cost,0)})`;
}

export async function addChargeControls(message,html){
  if(message.getFlag('vitruviy','activationResources')===true)return;
  const receipt=chargeReceipt(message);
  if(!receipt || !message.visible)return;
  const actor=await fromUuid(receipt.actorUuid),card=html.querySelector('.vit-chat');
  if(!actor?.isOwner || !card || card.querySelector('.vit-charge-refund'))return;
  const button=document.createElement('button');button.type='button';button.className='vit-charge-refund';
  button.title=t('ResourceRefundScope');
  button.dataset.messageId=message.id;button.dataset.actorUuid=actor.uuid;
  const refresh=()=>{const returned=chargesReturned(actor,receipt);button.disabled=refundPending.has(refundKey(message));button.textContent=refundLabel(receipt,false);};
  refresh();
  button.addEventListener('click',async()=>{
    button.disabled=true;
    try{await refundItemCharges(message,{repeat:true});}catch(error){ui.notifications.error(error.message);}finally{refresh();}
  });
  card.append(button);
}

export function refreshChargeControls(item){
  const actor=item.actor;if(!actor)return;
  for(const button of document.querySelectorAll('.vit-charge-refund')){
    if(button.dataset.actorUuid!==actor.uuid)continue;
    const message=game.messages.get(button.dataset.messageId),receipt=chargeReceipt(message);
    if(!receipt)continue;
    const returned=chargesReturned(actor,receipt);
    button.disabled=refundPending.has(refundKey(message));button.textContent=refundLabel(receipt,false);
  }
}
