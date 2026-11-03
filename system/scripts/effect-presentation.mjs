import {ATTRIBUTES} from './dice.mjs';
import {t,escape} from './rolls.mjs';
export function effectPresentation(effect){
  const changes=(effect.system?.changes??[]).filter(change=>ATTRIBUTES.some(key=>['attributes','attackBonuses','defenseBonuses'].some(group=>change.key===`system.${group}.${key}`)));
  const description=effect.description??'';
  const generated=(typeof effect.getFlag('vitruviy','generatedDescription')==='string'&&effect.getFlag('vitruviy','generatedDescription')===description)||effect.getFlag('vitruviy','itemEffect')&&ATTRIBUTES.some(key=>{
    const prefix=`<p>${escape(t(key))}: `;
    return description.startsWith(prefix)&&/^[+-]?\d+<\/p>$/.test(description.slice(prefix.length));
  });
  return {description:generated?'':description,changes:changes.map(change=>({label:`${t(change.key.split('.').at(-1))}${change.key.includes('Bonuses.')?' · '+t(change.key.includes('attackBonuses')?'Attack':'Defense'):''}`,value:`${change.type==='add'&&Number(change.value)>0?'+':''}${change.value}`}))};
}
