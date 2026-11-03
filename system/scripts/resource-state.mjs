import {resourceFormula} from './resource-formula.mjs';
import {chargeFormulaError} from './charge-formula.mjs';
import {t} from './rolls.mjs';
export const RESOURCE_LIMIT=16;


export function resourceDefinitions(){
  const count=Math.min(RESOURCE_LIMIT,Math.max(0,Number(game.settings.get('vitruviy','customResourceCount'))||0));
  const names=game.settings.get('vitruviy','customResourceNames')??[];
  return Array.from({length:count},(_entry,index)=>({id:`r${index}`,name:names[index]||`${t('CustomResource')} ${index+1}`}));
}
export function customResourceState(actor,definition){
  const config=actor.system.customResources?.[definition.id]??{};
  let maximum=0,error='',poolId='';
  try{
    if(config.maximumMode==='item'){
      const item=actor.items?.get(config.maximumItemId);
      if(!item?.system.chargesEnabled||chargeFormulaError(item)||!Number.isSafeInteger(item.system.charges.max)||item.system.charges.max<0)throw Error('Missing item');
      maximum=item.system.charges.max;poolId=item.id;
    }else maximum=Math.max(0,Math.floor(resourceFormula(config.maximum??'0',actor.system.attributes)));
  }catch{error=t(config.maximumMode==='item'?'ResourceMaximumItemMissing':'InvalidResourceFormula');}
  const stored=Number(poolId?actor.items.get(poolId).system.charges.value:config.value??0);
  return {...definition,config,maximum,poolId,value:Math.min(maximum,Math.max(0,Number.isSafeInteger(stored)?stored:0)),error};
}
export function customResourceViews(actor){return resourceDefinitions().map(definition=>customResourceState(actor,definition));}
