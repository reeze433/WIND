import {t,escape} from './rolls.mjs';
import {customResourceViews} from './resource-state.mjs';
import {writeResourceValues} from './resource-values.mjs';
import {checkedUpdate,checkedEmbeddedUpdate} from './document-writes.mjs';
import {serializeOperation} from './operations.mjs';
import {randomId} from './random-id.mjs';
import {chargeFormulaError} from './charge-formula.mjs';
export function restActors(){
  const controlled=canvas.tokens?.controlled??[];
  if(controlled.length)return [...new Map(controlled.filter(token=>token.actor).map(token=>[token.actor.uuid,token.actor])).values()];
  return [...game.actors].filter(actor=>{
    for(let folder=actor.folder;folder;folder=folder.folder)if(folder.name==='Игроки')return true;
    return game.users.some(user=>!user.isGM&&user.character?.uuid===actor.uuid);
  });
}
export async function restoreActor(actor,inspiration,id){
  if(!game.user.isGM||!actor?.isOwner)throw Error(t('NoPermission'));
  if(!Number.isSafeInteger(inspiration)||inspiration<0||!Number.isSafeInteger(actor.system.inspiration.value+inspiration))throw Error(t('InvalidCheck'));
  if(actor.getFlag('vitruviy',`rests.${id}`))return;
  if([...actor.items.values()].some(item=>item.system.chargesEnabled&&item.system.restRecovery&&chargeFormulaError(item)))throw Error(t('InvalidChargeFormula'));
  const entries=customResourceViews(actor).filter(state=>!state.error&&(!state.poolId||actor.items.get(state.poolId)?.system.restRecovery)).map(state=>({state,value:state.maximum}));
  // A counter and the item it mirrors are one pool, restored once.
  const bound=new Set(entries.map(entry=>entry.state.poolId).filter(Boolean));
  const items=[...actor.items.values()].filter(item=>item.system.chargesEnabled&&item.system.restRecovery&&!bound.has(item.id));
  if(items.length)await checkedEmbeddedUpdate(actor,'Item',items.map(item=>({_id:item.id,'system.charges.value':item.system.charges.max})));
  await writeResourceValues(actor,entries);
  await checkedUpdate(actor,{'system.health.value':actor.system.health.max,'system.inspiration.value':actor.system.inspiration.value+inspiration,[`flags.vitruviy.rests.${id}`]:true});
}
export async function rest(){
  if(!game.user.isGM)throw Error(t('NoPermission'));
  const actors=restActors();if(!actors.length)return ui.notifications.warn(t('RestSelectActors'));
  const choices=await foundry.applications.api.DialogV2.prompt({classes:['vitruviy','vit-dialog'],window:{title:t('Rest')},
    content:`<p>${t('RestHint')}</p>${actors.map((actor,index)=>`<label><input type="checkbox" name="actor${index}" checked> ${escape(actor.name)}</label>`).join('')}<label>${t('RestInspiration')}<input name="inspiration" type="number" value="1" min="0" step="1" required></label>`,
    ok:{label:t('Restore'),callback:(_event,button)=>Object.fromEntries(new FormData(button.form))},rejectClose:false});
  if(!choices)return;
  const amount=Number(choices.inspiration);if(!Number.isSafeInteger(amount)||amount<0)throw Error(t('InvalidCheck'));
  const selected=actors.filter((_actor,index)=>choices[`actor${index}`]);const id=randomId();
  let restored=0;
  for(const actor of selected)try{await serializeOperation(()=>restoreActor(actor,amount,id));restored++;}catch(error){ui.notifications.error(`${actor.name}: ${error.message}`);}
  ui.notifications.info(`${t('RestComplete')}: ${restored}/${selected.length}; ${t('Inspiration')} +${amount}`);
}
