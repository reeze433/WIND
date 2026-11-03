import {autoBloodMacroState} from './auto-blood.mjs';
import {ATTRIBUTES} from './dice.mjs';
import {t,escape} from './rolls.mjs';
export const macroDefinitions = () => [
  {id:'auto-blood',...autoBloodMacroState(),gm:true,command:'try { await game.wind.toggleAutoBlood(); } catch(error) { ui.notifications.error(error.message); }'},
  {id:'random-tile',name:t('RandomTile'),img:'icons/svg/blood.svg',gm:true,command:'await game.wind.randomTile();'},
  ...ATTRIBUTES.map(key=>({id:key,name:t(key),img:'icons/svg/d6-grey.svg',command:`await game.vitruviy.rollAttribute(game.vitruviy.selectedActor(), '${key}');`})),
  {id:'coin',name:t('CoinFlip'),img:'icons/svg/coins.svg',command:'await game.vitruviy.rollCoin({actor:game.vitruviy.selectedActor()});'},
  {id:'spend',name:t('SpendInspiration'),img:'icons/svg/coins.svg',command:'await game.vitruviy.spendInspiration(game.vitruviy.selectedActor());'},
  {id:'dice',name:t('CustomDice'),img:'icons/svg/d6-grey.svg',command:'await game.vitruviy.macroAction("dice");'},
  {id:'item',name:t('UseItem'),img:'icons/svg/item-bag.svg',command:'await game.vitruviy.macroAction("item");'},
  {id:'sheet',name:t('OpenSheet'),img:'icons/svg/book.svg',command:'game.vitruviy.selectedActor().sheet.render(true);'},
  {id:'resource',name:t('ToggleLastInspiration'),img:'icons/svg/coins.svg',command:'await game.vitruviy.macroAction("resource");'},
  {id:'initiative',name:t('RollInitiative'),img:'icons/svg/sword.svg',command:'await game.vitruviy.macroAction("initiative");'},
  {id:'roll-initiative-choose',name:t('RollInitiativeChoose'),img:'icons/svg/d6-grey.svg',command:'await game.wind.chooseAndRollInitiative();'},
  ...[['add','AddToCombat','sword'],['next','NextCombatTurn','direction'],['end','EndCombat','combat']].map(([action,label,icon])=>({id:`combat-${action}`,name:t(label),img:`icons/svg/${icon}.svg`,gm:true,command:`await game.vitruviy.combatAction('${action}');`})),
  {id:'rest',name:t('Rest'),img:'icons/svg/sleep.svg',gm:true,command:'await game.wind.rest();'},
  ...ATTRIBUTES.map(key=>({id:`initiative-${key}`,name:`${t('InitiativeSetting')} · ${t(key)}`,img:'icons/svg/d6-grey.svg',gm:true,command:`await game.wind.setInitiativeAttribute('${key}');`})),
  {id:'initiative-choose',name:t('InitiativeSetting'),img:'icons/svg/d6-grey.svg',gm:true,command:'await game.wind.setInitiativeAttribute();'},
  {id:'grant',name:t('GrantInspiration'),img:'icons/svg/coins.svg',gm:true,command:'await game.vitruviy.grantInspiration();'},
  {id:'vision',name:t('FixVision'),img:'icons/svg/eye.svg',gm:true,command:'await game.vitruviy.fixTokenVision();'},
  {id:'health',name:t('RepairHealthEstimate'),img:'icons/svg/heart.svg',gm:true,command:'await game.vitruviy.repairHealthEstimate();'}
];
let combatActionPending = false;
export async function combatAction(action,options={}) {
  if (!game.user.isGM) return ui.notifications.warn(t('GMOnlyCombat'));
  if (combatActionPending) return;
  combatActionPending = true;
  try {
    let combat = game.combats.viewed ?? game.combat;
    if (action === 'add') {
      const tokens = (canvas.tokens?.controlled ?? []).map(token => token.document).filter(token => token.actor);
      if (!tokens.length) return ui.notifications.warn(t('SelectCombatTokens'));
      combat ??= await CONFIG.Combat.documentClass.create({active:true,scene:canvas.scene.id}, {render:false});
      const missing = tokens.filter(token => !combat.combatants.some(c => c.tokenId === token.id && c.sceneId === token.parent.id));
      if (!missing.length) return ui.notifications.info(t('AlreadyInCombat'));
      return await CONFIG.Token.documentClass.createCombatants(missing, {combat});
    }
    if (!combat) return ui.notifications.warn(t('NoActiveCombat'));
    if (action === 'initiative') {
      const ids = combat.combatants.filter(c => c.initiative == null).map(c => c.id);
      if (!ids.length) return ui.notifications.info(t('InitiativeAlreadyRolled'));
      return await combat.rollInitiative(ids,options);
    }
    if (action === 'next') {
      if (!combat.combatants.size) return ui.notifications.warn(t('NoCombatParticipants'));
      return await (combat.started ? combat.nextTurn() : combat.startCombat());
    }
    if (action === 'end') return await combat.endCombat();
  } catch (error) {
    ui.notifications.error(error.message);
  } finally {
    combatActionPending = false;
  }
}
export function selectedActor() {
  const actor=canvas.tokens?.controlled?.[0]?.actor??game.user.character;
  if(!actor?.isOwner)throw new Error(t('NoPermission'));return actor;
}
export async function macroAction(action,options={}) {
  if(action==='resource') {
    const actor=selectedActor(),message=Array.from(game.messages).reverse().find(m=>m.visible&&m.getFlag('vitruviy','resource')?.actorUuid===actor.uuid);
    if(!message)return ui.notifications.warn(t('NoResourceMessage'));
    return game.vitruviy.toggleItemInspiration(message);
  }
  if(action==='initiative') {
    if(game.user.isGM) return combatAction('initiative',options);
    const actor=selectedActor(),combat=game.combats.viewed ?? game.combat;
    const combatant=combat?.combatants.find(c=>c.actor?.uuid===actor.uuid);
    if(!combatant)return ui.notifications.warn(t('NoCombatant'));
    if(combatant.initiative!=null)return ui.notifications.info(t('InitiativeAlreadyRolled'));
    return combat.rollInitiative([combatant.id],options);
  }
  if(action==='dice') {
    const count=await foundry.applications.api.DialogV2.prompt({classes:["vitruviy","vit-dialog"],window:{title:t('CustomDice')},content:'<input name="count" type="number" min="1" max="100" value="1">',ok:{label:t('Roll'),callback:(_e,b)=>Number(b.form.elements.count.value)},rejectClose:false});
    if(count!==null)return game.vitruviy.rollSuccessDice(count);
  } else {
    const actor=selectedActor(),items=Array.from(actor.items);
    const id=await foundry.applications.api.DialogV2.prompt({classes:["vitruviy","vit-dialog"],window:{title:t('UseItem')},content:`<select name="item">${items.map(i=>`<option value="${escape(i.id)}">${escape(i.name)}</option>`).join('')}</select>`,ok:{label:t('UseItem'),callback:(_e,b)=>b.form.elements.item.value},rejectClose:false});
    if(id)return game.vitruviy.rollItem(actor.items.get(id));
  }
}
export async function ensureMacroLibrary() {
  if(!game.user.isGM||game.user!==game.users.activeGM)return;
  let folder=game.folders.find(f=>f.type==='Macro'&&f.getFlag('vitruviy','macroLibrary'));
  folder??=await Folder.create({name:'Wind',type:'Macro',flags:{vitruviy:{macroLibrary:true}}});
  if(folder.name!=='Wind')await folder.update({name:'Wind'});
  for(const definition of macroDefinitions()) {
    const ownership={default:definition.gm?0:2};
    for(const user of game.users)if(user.isGM)ownership[user.id]=3;
    const data={name:definition.name,img:definition.img,type:'script',command:definition.command,folder:folder.id,ownership,flags:{vitruviy:{libraryMacro:definition.id}}};
    const existing=game.macros.find(m=>m.getFlag('vitruviy','libraryMacro')===definition.id)??game.macros.find(m=>definition.id==='grant'&&m.getFlag('vitruviy','grantInspiration')||definition.id==='vision'&&m.getFlag('vitruviy','fixTokenVision'));
    if(existing){data.flags={...existing.flags,vitruviy:{...existing.flags?.vitruviy,libraryMacro:definition.id}};if(Object.entries(data).some(([key,value])=>JSON.stringify(existing[key])!==JSON.stringify(value)))await existing.update(data,{recursive:false});}else await Macro.create(data);
  }
  const canonical=game.macros.find(m=>m.getFlag('vitruviy','libraryMacro')==='initiative');
  if(canonical)for(const old of game.macros.filter(m=>m.getFlag('vitruviy','libraryMacro')==='combat-initiative')){
    for(const user of game.users){const hotbar={...user.hotbar};let changed=false;for(const slot of Object.keys(hotbar))if(hotbar[slot]===old.id){hotbar[slot]=canonical.id;changed=true;}if(changed)await user.update({hotbar},{recursive:false});}
    await old.delete();
  }
}

export async function setInitiativeAttribute(attribute){
  if(!game.user.isGM)throw Error(t('NoPermission'));
  attribute??=await foundry.applications.api.DialogV2.prompt({classes:['vitruviy','vit-dialog'],window:{title:t('ChooseInitiative')},content:`<select name="attribute">${ATTRIBUTES.map(key=>`<option value="${key}">${t(key)}</option>`).join('')}</select>`,ok:{callback:(_event,button)=>button.form.elements.attribute.value},rejectClose:false});
  if(attribute===null)return;
  if(!ATTRIBUTES.includes(attribute))throw Error(t('InvalidCheck'));
  await game.settings.set('vitruviy','initiativeAttribute',attribute);
  ui.notifications.info(`${t('Initiative')}: ${t(attribute)}`);
}

let choosingInitiative=false;
export async function chooseAndRollInitiative(){
 if(choosingInitiative)return;choosingInitiative=true;
 try{
  const current=game.settings.get('vitruviy','initiativeAttribute');
  const attribute=await foundry.applications.api.DialogV2.prompt({classes:['vitruviy','vit-dialog'],window:{title:t('RollInitiativeChoose')},content:`<div class="vit-roll-form"><label>${t('Attribute')}<select name="attribute">${ATTRIBUTES.map(key=>`<option value="${key}" ${key===current?'selected':''}>${t(key)}</option>`).join('')}</select></label><p>${t('InitiativeOnceHint')}</p></div>`,ok:{label:t('RollInitiative'),callback:(_event,button)=>button.form.elements.attribute.value},rejectClose:false});
  if(attribute===null)return;if(!ATTRIBUTES.includes(attribute))throw Error(t('InvalidCheck'));
  return await macroAction('initiative',{attribute});
 }finally{choosingInitiative=false;}
}


