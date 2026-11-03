import {checkedUpdate} from './document-writes.mjs';
import {resourceDefinitions,customResourceState} from './resource-state.mjs';
import {t} from './rolls.mjs';

export function customSpendPlan(item){
  const id=item.system.customResourceId;if(!id)return null;
  if(!item.isOwner||!item.actor?.isOwner)throw new Error(t('NoPermission'));
  const definition=resourceDefinitions().find(entry=>entry.id===id);
  if(!definition)throw new Error(t('CustomResourceUnavailable'));
  const state=customResourceState(item.actor,definition),cost=item.system.customResourceCost??1;
  if(state.error||!Number.isSafeInteger(cost)||cost<1)throw new Error(t('InvalidResourceValue'));
  if(state.value<cost)throw new Error(`${state.name}: ${t('NotEnoughCustomResource')}`);
  return {id,name:state.name,cost,value:state.value,...(state.poolId?{poolId:state.poolId}:{})};
}
export function customRefundUpdates(actor,use,useId,{repeat=false}={}){
  const record=actor.getFlag('vitruviy',`customResourceUses.${useId}`);
  if(!record||record.id!==use.id||record.cost!==use.cost||!Number.isSafeInteger(record.cost)||record.cost<1)throw new Error(t('InvalidResourceValue'));
  if(record.refunded&&!repeat)return {};
  const state=customResourceState(actor,{id:use.id,name:use.name});
  if(state.error)throw new Error(state.error);
  if(record.poolId)return {[`flags.vitruviy.customResourceUses.${useId}`]:{...record,refunded:true}};
  return {[`system.customResources.${use.id}.value`]:Math.min(state.maximum,state.value+record.cost),[`flags.vitruviy.customResourceUses.${useId}`]:{...record,refunded:true}};
}
export async function withCustomResourceSpend(item,useId,callback){
  const plan=customSpendPlan(item);if(!plan)return callback(null);
  const {id,name,cost,poolId}=plan,use={id,name,cost,...(poolId?{poolId}:{})},actor=item.actor;
  await checkedUpdate(actor,{...(!poolId?{[`system.customResources.${id}.value`]:plan.value-cost}:{}),[`flags.vitruviy.customResourceUses.${useId}`]:{id,cost,...(poolId?{poolId}:{}),refunded:false}});
  try{return await callback(use);}
  catch(error){
    try{const updates=customRefundUpdates(actor,use,useId);if(Object.keys(updates).length)await checkedUpdate(actor,updates);}
    catch(refundError){console.error(refundError);ui.notifications.error(t('CustomResourceRefundFailed'));}
    throw error;
  }
}
