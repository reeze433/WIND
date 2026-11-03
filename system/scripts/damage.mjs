import {maybeSpawnBlood} from './auto-blood.mjs';
import {t, escape} from "./rolls.mjs";
import {defenseFor} from './targets.mjs';
import {checkedUpdate} from './document-writes.mjs';
import {resourceOperation,registerResourceAction} from './operations.mjs';
const pending = new Set();
async function applyValueNow(actor,message,amount,mode,tokenUuids=[]){
  if(!Number.isSafeInteger(amount)||amount<0||!['damage','healing'].includes(mode))throw new Error(t('InvalidCheck'));
  const key=message.id;
  const applications=Number(actor.getFlag('vitruviy',`damageApplied.${key}`)?.applications??0)+1;
  const before=actor.system.health.value;
  const health=Math.max(0,Math.min(actor.system.health.max,before+(mode==='healing'?amount:-amount)));
  await checkedUpdate(actor,{'system.health.value':health,[`flags.vitruviy.damageApplied.${key}`]:{amount,mode,user:game.user.id,applications}});
  const actual=actor.system.health.value;
  try{await maybeSpawnBlood(actor,{mode,amount:before-actual,tokenUuids});}catch(error){console.error('WIND | auto blood',error);if(game.user.isGM)ui.notifications.warn(`${t('AutoBloodFailed')}: ${error.message}`);}
  ui.notifications.info(`${actor.name}: ${t(mode==='healing'?'Healing':'Damage')} ${Math.abs(actual-before)} · ${t('Health')}: ${actual}`);
  return actor;
}
registerResourceAction('applyValue',async(actor,payload,user)=>{
  if(!user.isGM)throw new Error(t('NoPermission'));
  const message=await fromUuid(payload.messageUuid);
  if(!message?.getFlag('vitruviy','item')?.dealsDamage)throw new Error(t('InvalidCheck'));
  return applyValueNow(actor,message,payload.amount,payload.mode,payload.tokenUuids??[]);
});

export async function applyDamage(message) {
  if (!game.user.isGM) throw new Error(t("NoPermission"));
  const item = message.getFlag("vitruviy", "item");
  if (!item?.dealsDamage || !Number.isSafeInteger(item.potentialDamage) || item.potentialDamage < 0) return;
  if (pending.has(message.uuid)) return;
  pending.add(message.uuid);
  try {
    const groups={targeted:currentValueTargets(message,item),selected:(canvas.tokens?.controlled??[]).map(token=>({uuid:token.document.uuid,name:token.name}))};
    const rows=[...groups.targeted,...groups.selected];
    const candidates = new Map(rows.map(token=>[token.uuid,token]));
    if (!candidates.size) return ui.notifications.warn(t("SelectDamageTarget"));
    const outcomes=new Map(),healthViews=new Map(),attack=message.getFlag('vitruviy','check')?.total;
    await Promise.all([...candidates.keys()].map(async uuid=>{const actor=(await fromUuid(uuid))?.actor,response=actor?defenseFor(actor,message):null;if(actor)healthViews.set(uuid,{value:actor.system.health.value,max:actor.system.health.max});outcomes.set(uuid,response?.hidden?t('ResponseHidden'):Number.isSafeInteger(response?.total)&&Number.isSafeInteger(attack)?t(attack>response.total?'AttackWins':'AttackBlocked'):t('ValueNoResponse'));}));
    for(const token of rows){token.outcome=outcomes.get(token.uuid);token.health=healthViews.get(token.uuid);}
    const values = await foundry.applications.api.DialogV2.prompt({classes:["vitruviy","vit-dialog","vit-value-dialog"],window: {title: t("ApplyValue")},
      content: `<div class="vit-roll-form"><label>${t('ValueMode')}<select name="mode"><option value="damage" ${item.valueMode!=='healing'?'selected':''}>${t('Damage')}</option><option value="healing" ${item.valueMode==='healing'?'selected':''}>${t('Healing')}</option></select></label><label>${t('Value')}<input name="amount" type="number" value="${item.potentialDamage}" min="0" step="1" required></label><p class="vit-hint" title="${escape(t('ValueMultiplierHint'))}">${t('ValueActiveTabHint')} <i class="fas fa-circle-info" aria-hidden="true"></i></p>${valueTargetTabs(groups)}</div>`,
      render:(_event,dialog)=>{bindValueModifiers(dialog.element);bindValueTargets(dialog.element);bindValueSummary(dialog.element);},
      ok: {label: t("ApplyValue"), callback: (_event, button) => Object.fromEntries(new FormData(button.form))}, rejectClose: false});
    if (!values) return;
    if (!game.user.isGM) throw new Error(t("NoPermission"));
    const mode=values.mode??'damage';
    if(!['damage','healing'].includes(mode))throw new Error(t('InvalidCheck'));
    const amount = multipliedValue(Number(values.amount),1);
    if (!Number.isSafeInteger(amount) || amount < 0) throw new Error(t("InvalidCheck"));
    const chosen=selectedValueRows(rows,groups.targeted.length,values);
    const selected=values.target?[values.target]:[...chosen.keys()];
    if(!selected.length)throw Error(t('SelectActionTargets'));
    const actors=new Map();
    for(const uuid of selected){if(!candidates.has(uuid))throw Error(t('NoPermission'));const token=await fromUuid(uuid),actor=token?.actor;
      const index=chosen.get(uuid)??rows.findIndex(row=>row.uuid===uuid);
      const adjusted=multipliedValue(amount,Number(values[`multiplier${index}`]??values.multiplier??1));
      if(!actor?.isOwner||!['character','npc'].includes(actor.type))throw Error(t('NoPermission'));
      const key=actor.uuid??uuid,previous=actors.get(key);
      if(previous&&previous.amount!==adjusted)throw Error(t('ValueConflictingTokens'));
      actors.set(key,{actor,amount:adjusted,tokenUuids:[...(previous?.tokenUuids??[]),uuid]});}
    for(const {actor,amount,tokenUuids} of actors.values())await resourceOperation(actor,'applyValue',{messageUuid:message.uuid,amount,mode,tokenUuids},()=>applyValueNow(actor,message,amount,mode,tokenUuids));
    return [...actors.values()][0]?.actor;
  } finally { pending.delete(message.uuid); }
}

export function addDamageControls(message, html) {
  if (!game.user.isGM || !message.getFlag("vitruviy", "item")?.dealsDamage) return;
  const card = html.querySelector(".vit-chat");
  if (!card || card.querySelector(".vit-apply-damage")) return;
  const button = document.createElement("button");
  button.type = "button"; button.className = "vit-apply-damage"; button.textContent = t("ApplyValue");
  button.addEventListener("click", async () => {
    button.disabled = true;
    try { await applyDamage(message); } catch (error) { ui.notifications.error(error.message); }
    finally { button.disabled = false; }
  });
  card.append(button);
}

export function multipliedValue(amount,multiplier=1){
 if(!Number.isSafeInteger(amount)||amount<0||![0,.5,1,2].includes(multiplier))throw Error(t('InvalidCheck'));
 const result=Math.floor(amount*multiplier);if(!Number.isSafeInteger(result))throw Error(t('InvalidCheck'));return result;
}
export function bindValueModifiers(root){
 const amount=root.querySelector('[name="amount"]'),output=root.querySelector('[data-value-preview]');
 if(!amount)return;
 const outputs=[...root.querySelectorAll?.('[data-target-preview]')??[]];
 const refresh=()=>{for(const entry of outputs){try{entry.textContent=String(multipliedValue(Number(amount.value),Number(root.querySelector(`[name="multiplier${entry.dataset.targetPreview}"]:checked`)?.value??1)));}catch{entry.textContent='?';}} if(!output)return;try{output.textContent=String(multipliedValue(Number(amount.value),Number(root.querySelector('[name="multiplier"]:checked')?.value??1)));}catch{output.textContent='?';}};
 root.addEventListener('input',refresh);root.addEventListener('change',refresh);refresh();
}



function valueTargetRow(token,index,checked){
 return `<section class="vit-value-target-row"><div class="vit-value-target-heading"><label><input name="target${index}" type="checkbox" ${checked?'checked':''}> <span>${escape(token.name)}</span></label><span class="vit-value-outcome">${escape(token.outcome??t('ValueNoResponse'))}</span></div><fieldset class="vit-value-multipliers"><legend>${t('ValueMultiplier')}</legend>${[0,.5,1,2].map(factor=>`<label><input type="radio" name="multiplier${index}" value="${factor}" ${factor===1?'checked':''}><span>x${factor}</span></label>`).join('')}</fieldset><p class="vit-value-preview">${t('ValueAfterMultiplier')}: <output data-target-preview="${index}">0</output></p>${token.health?`<p class="vit-value-health">${t('Health')}: <output data-target-health="${index}" data-hp="${token.health.value}" data-max="${token.health.max}">${token.health.value} → ${token.health.value}</output></p>`:''}</section>`;
}
export function valueTargetTabs(groups){
 let index=0;
 const tabs=`<div class="vit-value-target-tabs" role="tablist">${['targeted','selected'].map((key,i)=>`<button type="button" role="tab" data-value-tab="${key}" aria-selected="${i===0}">${t(i===0?'Targeted':'Selected')} (${groups[key].length})</button>`).join('')}</div>`;
 return `<input type="hidden" name="valueTargetTab" value="targeted">`+tabs+['targeted','selected'].map((key,i)=>`<div class="vit-value-target-panel" role="tabpanel" data-value-panel="${key}" ${i?'hidden':''}>${groups[key].length?groups[key].map(token=>valueTargetRow(token,index++,true)).join(''):`<p class="vit-hint">${t('ValueTargetsEmpty')}</p>`}</div>`).join('');
}
export function bindValueTargets(root){
 const tabs=[...root.querySelectorAll('[data-value-tab]')],panels=[...root.querySelectorAll('[data-value-panel]')];
 for(const tab of tabs)tab.addEventListener('click',()=>{
  const field=root.querySelector?.('[name="valueTargetTab"]');if(field)field.value=tab.dataset.valueTab;
  for(const button of tabs)button.setAttribute('aria-selected',String(button===tab));
  for(const panel of panels)panel.hidden=panel.dataset.valuePanel!==tab.dataset.valueTab;
 });
}

export function selectedValueRows(rows,targetedCount,values){
 const chosen=new Map();
 rows.forEach((row,index)=>{if(!values[`target${index}`])return;
  if(values.valueTargetTab==='targeted'&&index>=targetedCount||values.valueTargetTab==='selected'&&index<targetedCount)return;
  if(!chosen.has(row.uuid))chosen.set(row.uuid,index);
 });
 return chosen;
}

export function healthPreview(before,maximum,amount,mode){return Math.max(0,Math.min(maximum,before+(mode==='healing'?amount:-amount)));}
export function bindValueSummary(root){
 const amount=root.querySelector('[name="amount"]'),mode=root.querySelector('[name="mode"]');
 const form=amount?.form??root.closest('form'),button=form?.querySelector('button[type="submit"]');
 if(!amount||!mode)return;
 const refresh=()=>{
  const active=root.querySelector('[role="tabpanel"]:not([hidden])');
  const count=active?.querySelectorAll('input[type="checkbox"]:checked').length??0;
  if(button){button.textContent=`${t(mode.value==='healing'?'ValueApplyHealing':'ValueApplyDamage')} (${count})`;button.disabled=count===0;}
  for(const output of root.querySelectorAll('[data-target-health]')){
   try{const value=multipliedValue(Number(amount.value),Number(root.querySelector(`[name="multiplier${output.dataset.targetHealth}"]:checked`)?.value??1));
    output.textContent=`${output.dataset.hp} → ${healthPreview(Number(output.dataset.hp),Number(output.dataset.max),value,mode.value)}`;
   }catch{output.textContent='?';}
  }
 };
 root.addEventListener('input',refresh);root.addEventListener('change',refresh);root.addEventListener('click',refresh);refresh();
}

// Read live user targets on each opening; an empty live selection must not revive stale targets.
export function currentValueTargets(message,item){
 const author=typeof message.author==='object'?message.author:game.users?.get?.(message.author);
 const gmTargets=[...(game.user.targets??[])];
 const source=gmTargets.length?gmTargets:author?.active&&author.targets!==undefined?[...author.targets]:game.user.targets!==undefined&&author?.id===game.user.id?[...game.user.targets]:null;
 if(source===null)return (item.targets??[]).map(token=>({...token}));
 return [...new Map(source.filter(token=>token.document?.uuid&&token.actor).map(token=>[token.document.uuid,{uuid:token.document.uuid,name:token.name}])).values()];
}