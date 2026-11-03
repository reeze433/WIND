import {cardDefaults} from './card-defaults.mjs';
import {normalizeCard} from './cards.mjs';
export class UniversalItem extends foundry.documents.Item {
  async _preCreate(data,options,user){
    const allowed=await super._preCreate(data,options,user);if(allowed===false)return false;
    if(data.system?.gridWidth===undefined)this.updateSource({'system.gridWidth':cardDefaults().gridWidth});
    return allowed;
  }
  static migrateData(source,options){return super.migrateData(normalizeCard(source),options);}
  static createDialog(data={},options={},dialogOptions={},renderOptions={}){
    return super.createDialog({...data,type:'card'},options,{...dialogOptions,types:['card']},renderOptions);
  }
}
