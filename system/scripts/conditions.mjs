import {escape} from './rolls.mjs';
const STATUS_NAMES = ["dead", "unconscious", "sleep", "stun", "prone", "restrain", "paralysis", "fly", "blind", "deaf", "silence", "fear", "burning", "frozen", "shock", "corrode", "bleeding", "disease", "poison", "curse", "regen", "degen", "hover", "burrow", "upgrade", "downgrade", "invisible", "target", "eye", "bless", "fireShield", "iceShield", "magicShield", "holyShield"];
const statusName = s => game.i18n.localize(STATUS_NAMES.includes(s.id) ? `VIT.status.${s.id}` : (s.name ?? s.label ?? s.id));
export const WOUNDED = 'vitruviy-wounded';
export const needsWound = health => Number(health.max) - Number(health.value) >= 2;
export function statusDefinitions() {
  return [...new Map(Object.values(CONFIG.statusEffects).filter(s=>s?.id).map(s=>[s.id,s])).values()];
}
export function registerWound() {
  CONFIG.statusEffects[WOUNDED] = {id:WOUNDED,name:'VIT.Wounded',img:'icons/svg/blood.svg'};
}
export function applyConditionCatalog() {
  for(const item of game.items) {
    const id=item.getFlag('vitruviy','statusId');
    if(id && CONFIG.statusEffects[id]) CONFIG.statusEffects[id]={...CONFIG.statusEffects[id],name:item.name,img:item.img};
  }
}
export function conditionViews(actor) {
  return [...actor.statuses].map(id=>{
    const definition=statusDefinitions().find(s=>s.id===id);
    const item=game.items.find(i=>i.getFlag('vitruviy','statusId')===id);
    const effect=actor.effects.find(e=>!e.disabled&&e.statuses.has(id));
    const name=item?.name ?? game.i18n.localize(definition?.name ?? effect?.name ?? id);
    return {statusId:id,name,img:item?.img ?? definition?.img ?? effect?.img ?? 'icons/svg/aura.svg',
      tooltip:`<strong>${escape(name)}</strong><p>${escape(item?.system.description ?? effect?.description ?? '')}</p>`};
  });
}
let catalogPending;
export async function ensureConditionCatalog() {
  if(!game.user.isGM || game.users.activeGM?.id!==game.user.id) return;
  if(catalogPending) return catalogPending;
  catalogPending=(async()=>{
    let folder=game.folders.find(f=>f.type==='Item'&&f.getFlag('vitruviy','conditionCatalog'));
    if(!folder) folder=await Folder.create({name:'Wind — Состояния',type:'Item',flags:{vitruviy:{conditionCatalog:true}}});
    const missing=statusDefinitions().filter(s=>!game.items.some(i=>i.getFlag('vitruviy','statusId')===s.id));
    if(missing.length) await Item.createDocuments(missing.map(s=>({type:'card',name:statusName(s),
      img:s.img ?? s.icon ?? 'icons/svg/aura.svg',folder:folder.id,ownership:{default:2},
      flags:{vitruviy:{statusId:s.id}},system:{category:'condition',description:s.id===WOUNDED?'Персонаж ранен. Состояние появляется при недостающих двух единицах здоровья и снимается при полном исцелении.':''}})));
  })();
  try {await catalogPending;applyConditionCatalog();} finally {catalogPending=null;}
}
const queues=new Map();
export function syncWound(actor) {
  const key=actor.uuid;
  const work=(queues.get(key)??Promise.resolve()).catch(()=>{}).then(async()=>{
    if(!actor.isOwner) return;
    const health=actor.system.health;
    if(needsWound(health)) await actor.toggleStatusEffect(WOUNDED,{active:true});
    else if(health.value>=health.max) await actor.toggleStatusEffect(WOUNDED,{active:false});
  });
  queues.set(key,work);
  return work.finally(()=>{if(queues.get(key)===work) queues.delete(key);});
}
export async function openCondition(actor,id) {
  const item=game.items.find(i=>i.getFlag('vitruviy','statusId')===id);
  if(item) return item.sheet.render(true);
  return actor.effects.find(e=>e.statuses.has(id))?.sheet.render(true);
}

const zeroHealthQueues=new Map();
export function syncZeroHealth(actor){
 const key=actor.uuid;
 const work=(zeroHealthQueues.get(key)??Promise.resolve()).catch(()=>{}).then(async()=>{
  if(!actor.isOwner||!Number.isFinite(actor.system?.health?.value))return;
  const zero=actor.system.health.value<=0,automatic=actor.getFlag('vitruviy','zeroHealthOverlay');
  if(zero){
   if(!actor.statuses.has('dead')){await actor.setFlag('vitruviy','zeroHealthOverlay',true);await actor.toggleStatusEffect('dead',{active:true,overlay:true});}
   else{for(const effect of actor.effects)if(effect.statuses.has('dead')&&!effect.getFlag('core','overlay'))await effect.update({'flags.core.overlay':true});}
  }else if(automatic){await actor.toggleStatusEffect('dead',{active:false});await actor.unsetFlag('vitruviy','zeroHealthOverlay');}
 });
 zeroHealthQueues.set(key,work);return work.finally(()=>{if(zeroHealthQueues.get(key)===work)zeroHealthQueues.delete(key);});
}
