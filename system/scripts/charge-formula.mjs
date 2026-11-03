import {resourceFormula} from './resource-formula.mjs';

export function chargeMaximum(system,actor){
  const formula=String(system.chargesMaxFormula??'').trim();
  if(!formula||!actor)return system.charges.max;
  return Math.max(0,Math.floor(resourceFormula(formula.replace(/\s+[xх]\s+/giu,' * '),actor.system.attributes)));
}
export function chargeFormulaError(item){
  try{chargeMaximum(item.system,item.actor);return false;}catch{return true;}
}
export function prepareChargeData(system,actor,sourceCharges=system.charges){
  if(!system.chargesEnabled||!String(system.chargesMaxFormula??'').trim()||!actor)return;
  try{system.charges.max=chargeMaximum(system,actor);}catch{system.charges.max=0;}
  system.charges.value=Math.min(system.charges.max,Math.max(0,sourceCharges?.value??0));
}
