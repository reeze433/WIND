import {ATTRIBUTES} from './dice.mjs';
import {rollAttribute,t,escape,checkHTML} from './rolls.mjs';
import {resourceOperation,registerResourceAction} from './operations.mjs';
import {checkedUpdate} from './document-writes.mjs';
import {randomId} from './random-id.mjs';
import {attributePool} from './branches.mjs';
import {evaluateCheck} from './rolls.mjs';

export function targetCandidates(item){
  const targets=[...(game.user.targets??[])],selected=globalThis.canvas?.tokens?.controlled??[];
  const candidates=new Map();
  for(const token of [...targets,...selected])if(token.actor&&token.document?.uuid)candidates.set(token.document.uuid,token);
  return {tokens:[...candidates.values()],targets:new Set(targets.map(token=>token.document.uuid)),selected:new Set(selected.map(token=>token.document.uuid))};
}
export function itemTargetSelection(item){
  const {tokens,targets,selected}=targetCandidates(item);
  if(!tokens.length)throw Error(t('SelectActionTargets'));
  const html=`<fieldset class="vit-activation-targets"><legend>${t('ConfirmTargets')}</legend><p>${escape(item.name)}. ${t('ChooseManyTargets')}</p>${tokens.map((token,index)=>`<label class="vit-activation-target"><input type="checkbox" name="target${index}" ${targets.size?targets.has(token.document.uuid)?'checked':'':selected.has(token.document.uuid)?'checked':''}><span>${escape(token.name)}</span><small>${[targets.has(token.document.uuid)?t('Targeted'):'',selected.has(token.document.uuid)?t('Selected'):''].filter(Boolean).join(' / ')}</small></label>`).join('')}</fieldset>`;
  return {html,choose(values){const chosen=tokens.filter((_token,index)=>values[`target${index}`]);if(!chosen.length)throw Error(t('SelectActionTargets'));return chosen;}};
}
export async function confirmItemTargets(item,{extraHTML='',onConfirm}={}){
  const selection=itemTargetSelection(item);
  const values=await foundry.applications.api.DialogV2.prompt({classes:['vitruviy','vit-dialog'],window:{title:t('ConfirmTargets')},
    content:`<div class="vit-roll-form">${selection.html}${extraHTML}</div>`,
    ok:{label:t('ConfirmTargets'),callback:(_event,button)=>Object.fromEntries(new FormData(button.form))},rejectClose:false});
  if(values===null)return null;
  const chosen=selection.choose(values);onConfirm?.(values);return chosen;
}

export function privateResponses(){return game.settings?.get('vitruviy','responseRollVisibility')==='gm';}
export function defenseFor(actor,message){
  const marker=actor.getFlag('vitruviy',`defenses.${message.id}`);
  if(!marker?.hidden)return marker;
  if(!game.user.isGM)return {hidden:true};
  const receipt=[...(game.messages??[])].reverse().find(entry=>entry.visible!==false&&entry.getFlag('vitruviy','response')?.messageUuid===message.uuid&&entry.getFlag('vitruviy','response')?.actorUuid===actor.uuid);
  return receipt?.getFlag('vitruviy','response')?.result??marker;
}
export async function recordDefense(actor,message,result,user=game.user,rolls=[],options={}){
  const targets=message?.getFlag('vitruviy','item')?.targets??[];
  let matches=false;
  for(const target of targets){const token=await fromUuid(target.uuid);if(token?.actor?.uuid===actor.uuid)matches=true;}
  if(!matches||!ATTRIBUTES.includes(result.attribute)||!Number.isSafeInteger(result.total)||result.total<0)throw Error(t('NoPermission'));
  const visibility=options.visibility??result.messageMode??(privateResponses()?'gm':'public');
  if(!['public','gm'].includes(visibility))throw Error(t('InvalidCheck'));
  const hidden=visibility==='gm';
  if(hidden&&!game.user.isGM)throw Error(t('ResourceNeedsGM'));
  const branch=result.branch??'defense';
  if(!['base','attack','defense'].includes(branch))throw Error(t('InvalidCheck'));
  const summary={total:result.total,attribute:result.attribute,...(result.critical?{critical:true}:{}),...(result.branch?{branch}:{})};
  const whisper=hidden?[...game.users].filter(entry=>entry.isGM).map(entry=>entry.id):[];
  const receipt=await ChatMessage.create({author:hidden?game.user.id:user.id,speaker:ChatMessage.getSpeaker({actor}),rolls,whisper,blind:hidden,
    content:checkHTML(result,`${t('ResponseRoll')} - ${t(result.attribute)} - ${t(branch==='base'?'BaseAttribute':branch==='attack'?'Attack':'Defense')}`),
    flags:{vitruviy:{response:{messageUuid:message.uuid,actorUuid:actor.uuid,result:summary}}}});
  if(!receipt)throw Error(t('UpdateCancelled'));
  const path=`flags.vitruviy.defenses.${message.id}`;
  const remove=hidden?['total','attribute','branch','critical']:['hidden',...(!result.critical?['critical']:[])];
  await checkedUpdate(actor,{[path]:hidden?{hidden:true}:summary,...Object.fromEntries(remove.map(key=>[`${path}.-=${key}`,null]))});
  await checkedUpdate(message,{'flags.vitruviy.defenseRefresh':randomId()});
}
registerResourceAction('defend',async(actor,payload,user)=>{
  const message=await fromUuid(payload.messageUuid);
  if(!message?.getFlag('vitruviy','item')?.dealsDamage)throw Error(t('NoPermission'));
  const visibility=payload.visibility??(privateResponses()?'gm':'public'),branch=payload.branch??'defense';
  if(!['base','attack','defense'].includes(branch))throw Error(t('InvalidCheck'));
  if(!['public','gm'].includes(visibility))throw Error(t('InvalidCheck'));
  if(visibility==='gm'){
    if(!ATTRIBUTES.includes(payload.attribute)||!['normal','advantage','disadvantage'].includes(payload.mode))throw Error(t('InvalidCheck'));
    const result=await evaluateCheck({pool:attributePool(actor,payload.attribute,branch),mode:payload.mode,repeats:payload.mode==='normal'?0:1});
    return recordDefense(actor,message,{...result,attribute:payload.attribute,branch},user,result.rolls,{visibility});
  }
  return recordDefense(actor,message,{...payload.result,branch},user,(payload.rolls??[]).map(data=>Roll.fromData(data)),{visibility});
});
const pendingResponses=new Set();
export async function defend(actor,message){
  if(!actor?.isOwner)throw Error(t('NoPermission'));
  const key=`${actor.uuid}:${message.uuid??message.id}`;if(pendingResponses.has(key))return;pendingResponses.add(key);
  try{
  const defaultVisibility=privateResponses()?'gm':'public';
  const values=await foundry.applications.api.DialogV2.prompt({classes:['vitruviy','vit-dialog'],window:{title:`${t('ResponseRoll')} - ${actor.name}`},
    content:`<div class="vit-roll-form"><label>${t('Attribute')}<select name="attribute">${ATTRIBUTES.map(key=>`<option value="${key}">${t(key)} (${attributePool(actor,key)})</option>`).join('')}</select></label><label>${t('RollBranch')}<select name="branch"><option value="base">${t('BaseAttribute')}</option><option value="attack">${t('Attack')}</option><option value="defense" selected>${t('Defense')}</option></select></label><label>${t('Mode')}<select name="mode">${['normal','advantage','disadvantage'].map(mode=>`<option value="${mode}">${t(mode)}</option>`).join('')}</select></label><label>${t('RollMode')}<select name="rollMode"><option value="public" ${defaultVisibility==='public'?'selected':''}>${t('Public')}</option><option value="gm" ${defaultVisibility==='gm'?'selected':''}>${t('Hidden')}</option></select></label><output class="vit-response-pools" data-response-pools></output><p class="vit-hint" title="${escape(t('ResponseVisibilityChoiceHint'))}">${t('ResponseVisibilityShort')}</p></div>`,render:(_event,dialog)=>bindResponsePools(dialog.element,actor),ok:{label:t('Roll'),callback:(_event,button)=>Object.fromEntries(new FormData(button.form))},rejectClose:false});
  if(values===null)return;
  const attribute=values.attribute,branch=values.branch??'defense',mode=values.mode??'normal',visibility=values.rollMode??defaultVisibility;
  if(!['base','attack','defense'].includes(branch)||!ATTRIBUTES.includes(attribute)||!['normal','advantage','disadvantage'].includes(mode)||!['public','gm'].includes(visibility))throw Error(t('InvalidCheck'));
  if(visibility==='gm')return await resourceOperation(actor,'defend',{messageUuid:message.uuid,attribute,branch,mode,visibility},async()=>{
    if(!game.user.isGM)throw Error(t('ResourceNeedsGM'));
    const result=await evaluateCheck({pool:attributePool(actor,attribute,branch),mode,repeats:mode==='normal'?0:1});
    await recordDefense(actor,message,{...result,attribute,branch},game.user,result.rolls,{visibility});
  });
  const result=await evaluateCheck({pool:attributePool(actor,attribute,branch),mode,repeats:mode==='normal'?0:1});
  const {rolls,...snapshot}=result;snapshot.attribute=attribute;snapshot.branch=branch;snapshot.messageMode=visibility;
  return await resourceOperation(actor,'defend',{messageUuid:message.uuid,result:snapshot,rolls:rolls.map(roll=>roll.toJSON()),branch,visibility},()=>recordDefense(actor,message,snapshot,game.user,rolls,{visibility}));
  }finally{pendingResponses.delete(key);for(const button of globalThis.document?.querySelectorAll?.('.vit-response-button')??[])if(button.dataset?.responseKey===key)button.disabled=false;}
}
export async function addTargetControls(message,html){
  if(!message.visible||message.isContentVisible===false)return;
  const item=message.getFlag('vitruviy','item'),card=html.querySelector('.vit-chat');
  if(!message.visible||!item?.targets?.length||!card||card.querySelector('.vit-chat-targets'))return;
  const list=document.createElement('section');list.className='vit-chat-targets';
  const heading=document.createElement('h4');heading.textContent=t('ResponseTargets');list.append(heading);
  const uuids=[...new Set(item.targets.map(target=>target.uuid))];
  const tokens=new Map(await Promise.all(uuids.map(async uuid=>[uuid,await fromUuid(uuid)])));
  for(const target of item.targets){
    const actor=tokens.get(target.uuid)?.actor;if(!actor)continue;
    const row=document.createElement('div');row.className='vit-chat-target';
    const name=document.createElement('strong');name.className='vit-response-name';name.textContent=target.name;row.append(name);
    const defense=defenseFor(actor,message);
    if(defense){
      const text=document.createElement('p');text.className='vit-response-summary';
      text.textContent=defense.hidden?t('ResponseHidden'):`${t('ResponseRoll')}: ${defense.total} (${t(defense.attribute)}${defense.branch?' - '+t(defense.branch==='base'?'BaseAttribute':defense.branch==='attack'?'Attack':'Defense'):''})`;
      row.append(text);
      const attack=message.getFlag('vitruviy','check')?.total;
      if(!defense.hidden&&Number.isSafeInteger(attack)){const outcome=document.createElement('p');outcome.className='vit-response-outcome';outcome.textContent=t(attack>defense.total?'AttackWins':'AttackBlocked');row.append(outcome);}
    }
    if(actor.isOwner&&item.dealsDamage){const button=document.createElement('button');button.type='button';button.className='vit-response-button';button.textContent=t('ResponseRoll');button.dataset.responseKey=`${actor.uuid}:${message.uuid??message.id}`;button.disabled=pendingResponses.has(button.dataset.responseKey);
      button.addEventListener('click',async()=>{button.disabled=true;try{await defend(actor,message);}catch(error){ui.notifications.error(error.message);}finally{button.disabled=false;}});row.append(button);}
    list.append(row);
  }
  card.append(list);
}

export function bindResponsePools(root,actor){
 const attribute=root.querySelector('[name="attribute"]'),branch=root.querySelector('[name="branch"]'),output=root.querySelector('[data-response-pools]');
 if(!attribute||!branch||!output)return;
 const refresh=()=>{const names={base:'BaseAttribute',attack:'Attack',defense:'Defense'};
  for(const option of branch.options)option.textContent=`${t(names[option.value])} (${attributePool(actor,attribute.value,option.value)})`;
  output.textContent=`${t('Pool')}: ${attributePool(actor,attribute.value,branch.value)}`;
 };
 root.addEventListener('change',refresh);refresh();
}

