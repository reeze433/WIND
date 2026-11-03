import {t} from './rolls.mjs';
const nameCollator=new Intl.Collator('ru',{numeric:true,sensitivity:'base'});
export function indexCards(items){const groups=new Map(CATEGORIES.map(type=>[type,[]])),children=new Map();for(const item of items){groups.get(categoryOf(item)).push(item);const source=item.system.chargeSourceId;if(source){if(!children.has(source))children.set(source,[]);children.get(source).push({name:item.name,cost:item.system.sourceChargeCost});}}return {groups,children};}
export const CATEGORIES=['condition','ability','equipment','custom','other'];
export function preparedCount(items,category){return Array.from(items).filter(item=>categoryOf(item)===category&&item.system.prepared===true).length;}
export function categoryOf(item){const category=item.system?.category??item.type;return category==='trait'?'ability':CATEGORIES.includes(category)?category:'equipment';}
export function normalizeCard(source){
  if(CATEGORIES.includes(source.type)||source.type==='trait'){
    source.system??={};source.system.category??=source.type;source.type='card';
  }
  if(source.system?.category==='trait')source.system.category='ability';
  return source;
}
export function orderCards(items,mode='manual'){
  return [...items].sort((a,b)=>{
    const name=nameCollator.compare(a.name,b.name);
    if(mode==='nameAsc')return name;
    if(mode==='nameDesc')return -name;
    if(mode==='quantityDesc')return Number(b.system.quantity)-Number(a.system.quantity)||name;
    if(mode==='quantityAsc')return Number(a.system.quantity)-Number(b.system.quantity)||name;
    return (a.sort??0)-(b.sort??0)||String(a.id).localeCompare(String(b.id));
  });
}

export function categoryLabel(category){return category==='custom'?(String(game.settings.get('vitruviy','customPanelName')??'').trim()||t('custom')):t(category);}
