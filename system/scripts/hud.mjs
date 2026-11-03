import {categoryOf,categoryLabel} from "./cards.mjs";
import {ATTRIBUTES} from './dice.mjs';
import {t} from './rolls.mjs';
export function itemHudInformation(item){
  const information={};
  if(item.system.chargesEnabled)information.info1={text:`${item.system.charges.value}/${item.system.charges.max}`,title:t('Charges')};
  const source=item.actor?.items.get(item.system.chargeSourceId);
  if(source?.system.chargesEnabled)information.info2={text:`${source.system.charges.value}/${source.system.charges.max}`,title:`${t('ChargeSource')}: ${source.name}`};
  return information;
}
export function installHud(core) {
  class Actions extends core.api.ActionHandler {
    async buildSystemActions() {
      const actor=this.actor;if(!actor?.isOwner)return;
      const action=(id,name,actionType,actionId,img)=>({id,name,img,system:{actionType,actionId}});
      this.addActions(ATTRIBUTES.map(k=>({...action(k,t(k),'attribute',k),info1:{text:String(actor.system.attributes[k])}})),{id:'attributes'});
      for(const type of ['equipment','ability','custom','condition','other'])this.addActions(Array.from(actor.items).filter(i=>categoryOf(i)===type&&i.system.prepared===true).map(i=>({...action(i.id,i.name,'item',i.id,i.img),...itemHudInformation(i)})),{id:type});
      this.addActions(Array.from(actor.effects).map(e=>({...action(e.id,e.name,'effect',e.id,e.img),cssClass:e.disabled?'':'active'})),{id:'effects'});
      this.addActions([action('coin',t('CoinFlip'),'coin'),action('spend',t('SpendInspiration'),'spend'),action('sheet',t('OpenSheet'),'sheet'),action('dice',t('CustomDice'),'dice')],{id:'utility'});
    }
  }
  class Rolls extends core.api.RollHandler {
    async handleActionClick() {
      try {
      const actor=this.actor;if(!actor?.isOwner)return;
      const {actionType,actionId}=this.action.system;
      if(actionType==='attribute')await game.vitruviy.rollAttribute(actor,actionId,{chooseBranch:true});
      else if(actionType==='item') {const item=actor.items.get(actionId);if(!item)return;if(this.isRenderItem())await item.sheet.render(true);else if(item.system.prepared===true)await game.vitruviy.rollItem(item);else ui.notifications.warn(t('ItemNotPrepared'));}
      else if(actionType==='coin')await game.vitruviy.rollCoin({actor});
      else if(actionType==='spend')await game.vitruviy.spendInspiration(actor);
      else if(actionType==='effect'){const effect=actor.effects.get(actionId);if(effect)await effect.update({disabled:!effect.disabled});}
      else if(actionType==='sheet')actor.sheet.render(true);
      else if(actionType==='dice')await game.vitruviy.macroAction('dice');
      } catch(error) { ui.notifications.error(error?.message??String(error)); }
    }
  }
  class Manager extends core.api.SystemManager {
    getActionHandler(){return new Actions();}
    getAvailableRollHandlers(){return {core:'Wind'};}
    getRollHandler(){return new Rolls();}
    registerSettings(){}
    async registerDefaults(){
      const groups=['equipment','ability','custom','attributes','effects','condition','other','utility'].map(id=>({id,name:id==='custom'?categoryLabel(id):t(id==='attributes'?'Attributes':id==='utility'?'Utility':id),type:'system'}));
      return {groups,layout:groups.map(g=>({id:g.id,nestId:g.id,name:g.name,groups:[{...g,nestId:`${g.id}_actions`}]}))};
    }
  }
  Hooks.callAll('tokenActionHudSystemReady',{api:{requiredCoreModuleVersion:'2.1',SystemManager:Manager}});
}
Hooks.once('tokenActionHudCoreApiReady',installHud);
