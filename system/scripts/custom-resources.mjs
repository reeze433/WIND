import {writeResourceValues} from './resource-values.mjs';
import {checkedUpdate} from './document-writes.mjs';
import {serializeOperation,resourceOperation,registerResourceAction} from './operations.mjs';
import {validatedDialog} from './validated-dialog.mjs';
import {resourceFormula} from './resource-formula.mjs';
import {t,escape} from './rolls.mjs';
import {RESOURCE_LIMIT,resourceDefinitions,customResourceState,customResourceViews} from './resource-state.mjs';
export {RESOURCE_LIMIT,resourceDefinitions,customResourceState,customResourceViews};
export async function setCustomResourceValue(actor,id,value){
  return resourceOperation(actor,'setCustomResource',{id,value},()=>setCustomResourceValueNow(actor,id,value));
}
registerResourceAction('setCustomResource',(actor,payload)=>setCustomResourceValueNow(actor,payload.id,payload.value));
async function setCustomResourceValueNow(actor,id,value){
  if(!actor?.isOwner)throw new Error(t('NoPermission'));
  const definition=resourceDefinitions().find(entry=>entry.id===id);if(!definition)throw new Error(t('InvalidCheck'));
  const state=customResourceState(actor,definition);
  if(state.error||!Number.isSafeInteger(value)||value<0||value>state.maximum)throw new Error(t('InvalidResourceValue'));
  await writeResourceValues(actor,[{state,value}]);
}
async function saveResourceConfiguration(actor,id,values){
  const state=customResourceViews(actor).find(entry=>entry.id===id);if(!state)throw new Error(t('InvalidCheck'));
  const entry=resourceConfiguration(actor,id,state,values);
  const next=customResourceState({items:actor.items,system:{attributes:actor.system.attributes,customResources:{[id]:entry}}},state);
  await writeResourceValues(actor,[{state:next,value:entry.value}],{[`system.customResources.${id}`]:entry});
}
registerResourceAction('configureResource',(actor,payload)=>saveResourceConfiguration(actor,payload.id,payload.values));
export async function configureCustomResource(actor,id){
  if(!actor?.isOwner)throw new Error(t('NoPermission'));
  const state=customResourceViews(actor).find(entry=>entry.id===id);if(!state)throw new Error(t('InvalidCheck'));
  const config=state.config;
  const modes=['none','round','turn'];
  const items=Array.from(actor.items?.values()??[]).filter(item=>item.system.chargesEnabled);
  const values=await validatedDialog().prompt({classes:['vitruviy','vit-dialog'],window:{title:state.name},
    content:`<div class="vit-roll-form"><label>${t('ResourceCurrent')}<input name="value" type="number" min="0" step="1" value="${state.value}" required></label><label>${t('ResourceMaximumMode')}<select name="maximumMode"><option value="formula" ${config.maximumMode!=='item'?'selected':''}>${t('ResourceMaximumFormula')}</option><option value="item" ${config.maximumMode==='item'?'selected':''}>${t('ResourceMaximumItem')}</option></select></label><label data-maximum-kind="formula">${t('ResourceMaximumFormula')}<input name="maximum" value="${escape(config.maximum??'0')}" required></label><label data-maximum-kind="item" data-resource-max-drop>${t('ResourceMaximumItem')}<select name="maximumItemId"><option value="">—</option>${items.map(item=>`<option value="${escape(item.id)}" ${item.id===config.maximumItemId?'selected':''}>${escape(item.name)} (${item.system.charges.max})</option>`).join('')}</select></label><p>${t('ResourceMaximumItemHint')}</p><label>${t('ResourceRecoveryMode')}<select name="recoveryMode">${modes.map(mode=>`<option value="${mode}" ${mode===(config.recoveryMode??'none')?'selected':''}>${t(`ResourceRecovery_${mode}`)}</option>`).join('')}</select></label><label>${t('ResourceRecoveryFormula')}<input name="recovery" value="${escape(config.recovery??'0')}" required></label><label>${t('ResourceFillNow')}<input name="fill" type="checkbox"></label><p>${t('ResourceFormulaHint')}</p><p data-resource-preview aria-live="polite"></p><p data-validation-error role="alert" hidden></p></div>`,
    render:(_event,dialog)=>{
      const element=dialog.element,mode=element.querySelector('[name="maximumMode"]');
      const refresh=()=>{for(const label of element.querySelectorAll('[data-maximum-kind]')){const active=label.dataset.maximumKind===mode.value;label.hidden=!active;label.style.display=active?'':'none';label.querySelector('input,select').disabled=!active;}};
      const preview=()=>{const output=element.querySelector('[data-resource-preview]');
        try{const values=Object.fromEntries(new FormData(element.querySelector('form'))),entry=resourceConfiguration(actor,id,state,{...values,value:'0',fill:undefined});
          const maximum=customResourceState({items:actor.items,system:{attributes:actor.system.attributes,customResources:{[id]:entry}}},state).maximum;
          output.textContent=`${t('ResourceMaximum')}: ${maximum}; ${t('ResourceRecoveryPreview')}: ${Math.max(0,Math.floor(resourceFormula(entry.recovery,actor.system.attributes,{maximum})))}`;
        }catch(error){output.textContent=error.message;}};
      const useItemValue=()=>{if(mode.value==='item'){const item=actor.items.get(element.querySelector('[name="maximumItemId"]').value);if(item)element.querySelector('[name="value"]').value=item.system.charges.value;}};
      mode.addEventListener('change',()=>{refresh();useItemValue();preview();});element.querySelector('[name="maximumItemId"]').addEventListener('change',()=>{useItemValue();preview();});refresh();
      element.addEventListener('input',preview);element.addEventListener('change',preview);preview();
      const drop=element.querySelector('[data-resource-max-drop]');
      drop.addEventListener('dragover',event=>{event.preventDefault();event.stopPropagation();});
      drop.addEventListener('drop',async event=>{
        event.preventDefault();event.stopPropagation();
        try{const data=foundry.applications.ux.TextEditor.getDragEventData(event),item=data.type==='Item'?await fromUuid(data.uuid):null;
          if(item?.actor?.uuid!==actor.uuid||!item.system.chargesEnabled)throw new Error(t('ResourceMaximumItemMissing'));
          mode.value='item';element.querySelector('[name="maximumItemId"]').value=item.id;refresh();useItemValue();preview();
        }catch(error){ui.notifications.error(error.message);}
      });
    },
    ok:{label:t('SaveSettings'),callback:async(_event,button)=>{const values=Object.fromEntries(new FormData(button.form));resourceConfiguration(actor,id,state,values);await resourceOperation(actor,'configureResource',{id,values},()=>saveResourceConfiguration(actor,id,values));return true;}},rejectClose:false});
  if(!values)return;

}

export function resourceConfiguration(actor,id,state,values){
  const config=state.config,modes=['none','round','turn'];
  let maximum,recovery;
  const maximumMode=values.maximumMode??'formula',maximumFormula=values.maximum??config.maximum??'0',maximumItemId=values.maximumItemId??config.maximumItemId??'';
  if(!['formula','item'].includes(maximumMode))throw new Error(t('InvalidResourceFormula'));
  const preview=customResourceState({items:actor.items,system:{attributes:actor.system.attributes,customResources:{[id]:{maximum:maximumFormula,maximumMode,maximumItemId}}}},state);
  if(preview.error)throw new Error(preview.error);
  try{maximum=preview.maximum;recovery=resourceFormula(values.recovery,actor.system.attributes,{maximum});}
  catch{throw new Error(t('InvalidResourceFormula'));}
  if(recovery<0||!modes.includes(values.recoveryMode))throw new Error(t('InvalidResourceFormula'));
  const value=values.fill?maximum:Number(values.value);
  if(!Number.isSafeInteger(value)||value<0||value>maximum)throw new Error(t('InvalidResourceValue'));
  return {value,maximum:maximumFormula,maximumMode,maximumItemId,recovery:values.recovery,recoveryMode:values.recoveryMode};
}

export async function recoverCustomResources(combat,changes){
  if(game.users.activeGM?.id!==game.user.id||combat.round<1||!('round' in changes||'turn' in changes))return;
  const actors=new Map();for(const entry of combat.combatants)if(entry.actor)actors.set(entry.actor.uuid,entry.actor);
  for(const actor of actors.values()){
    const updates={},entries=[];
    for(const state of customResourceViews(actor)){
      const mode=state.config.recoveryMode;
      if(!['round','turn'].includes(mode)||state.error)continue;
      if(mode==='round'&&!('round' in changes))continue;
      if(mode==='turn'&&combat.combatant?.actor?.uuid!==actor.uuid)continue;
      const eventKey=mode==='round'?'round':`turn-${combat.combatant.id}`;
      const key=`customResourceRecovery.${combat.id}.${eventKey}.${state.id}`;
      if(Number((state.poolId?actor.items.get(state.poolId)?.getFlag('vitruviy',key):actor.getFlag('vitruviy',key))??0)>=combat.round)continue;
      try{
        const amount=Math.max(0,Math.floor(resourceFormula(state.config.recovery??'0',actor.system.attributes,{maximum:state.maximum})));
        entries.push({state,value:Math.min(state.maximum,state.value+amount),...(state.poolId?{itemChanges:{[`flags.vitruviy.${key}`]:combat.round}}:{})});
        updates[`flags.vitruviy.${key}`]=combat.round;
      }catch{ui.notifications.warn(`${actor.name}: ${state.name} — ${t('InvalidResourceFormula')}`);}
    }
    if(Object.keys(updates).length)await writeResourceValues(actor,entries,updates);
  }
}

export class CustomResourceSettings extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2){
  static DEFAULT_OPTIONS={id:'wind-custom-resources',classes:['vitruviy'],tag:'form',position:{width:500,height:580},window:{title:'VIT.CustomResources',resizable:true},form:{closeOnSubmit:true,handler:this.save}};
  static PARTS={body:{template:'systems/vitruviy/templates/resource-settings.hbs'}};
  async _prepareContext(){
    const names=game.settings.get('vitruviy','customResourceNames')??[],count=game.settings.get('vitruviy','customResourceCount')??0;
    return {count,limit:RESOURCE_LIMIT,resources:Array.from({length:RESOURCE_LIMIT},(_entry,index)=>({index,value:names[index]??'',number:index+1,visible:index<count}))};
  }
  _onRender(context,options){
    super._onRender(context,options);
    this.element.querySelector('[name="count"]').addEventListener('input',event=>{
      for(const row of this.element.querySelectorAll('[data-resource-index]'))row.hidden=Number(row.dataset.resourceIndex)>=Number(event.target.value);
    });
  }
  static async save(_event,_form,data){
    if(!game.user.isGM)throw new Error(t('NoPermission'));
    const count=Number(data.object.count);if(!Number.isInteger(count)||count<0||count>RESOURCE_LIMIT)throw new Error(t('InvalidCheck'));
    const names=Array.from({length:RESOURCE_LIMIT},(_entry,index)=>String(data.object[`resourceName${index}`]??'').trim());
    if(names.some(name=>name.length>40))throw new Error(t('InvalidCheck'));
    await game.settings.set('vitruviy','customResourceNames',names);
    await game.settings.set('vitruviy','customResourceCount',count);
  }
}
export function registerCustomResources(){
  const refresh=()=>{for(const actor of game.actors??[])for(const app of Object.values(actor.apps??{}))app.render(false);};
  game.settings.register('vitruviy','customResourceCount',{scope:'world',config:false,type:Number,default:0,onChange:refresh});
  game.settings.register('vitruviy','customResourceNames',{scope:'world',config:false,type:Array,default:[],onChange:refresh});
  Hooks.on('updateCombat',(combat,changes)=>{
    const snapshot={id:combat.id,round:combat.round,combatant:combat.combatant,combatants:[...combat.combatants]};
    serializeOperation(()=>recoverCustomResources(snapshot,{...changes})).catch(console.error);
  });
}
