import {checkedUpdate,checkedEmbeddedUpdate} from './document-writes.mjs';
// Item-bound counters are views of the item's pool, not independent balances.
export async function writeResourceValues(actor,entries,changes={}){
  const updates=new Map();
  for(const {state,value,itemChanges={}} of entries){
    if(state.error||!Number.isSafeInteger(value)||value<0||value>state.maximum)throw Error(game.i18n.localize('VIT.InvalidResourceValue'));
    if(state.poolId){
      const previous=updates.get(state.poolId);
      updates.set(state.poolId,{...previous,...itemChanges,_id:state.poolId,'system.charges.value':Math.max(previous?.['system.charges.value']??0,value)});
    }else changes[`system.customResources.${state.id}.value`]=value;
  }
  if(updates.size)await checkedEmbeddedUpdate(actor,'Item',[...updates.values()]);
  if(Object.keys(changes).length)await checkedUpdate(actor,changes);
}
