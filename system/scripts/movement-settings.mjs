import {DEFAULT_MOVEMENT,installMovementRuler} from './movement-budget.mjs';
export class MovementSettings extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2){
  static DEFAULT_OPTIONS={id:'wind-movement',classes:['vitruviy'],tag:'form',position:{width:480},window:{title:'VIT.MovementCalculation'},form:{closeOnSubmit:true,handler:this.save}};
  static PARTS={body:{template:'systems/vitruviy/templates/movement-settings.hbs'}};
  async _prepareContext(){const table=game.settings.get('vitruviy','movementTable');return {enabled:game.settings.get('vitruviy','movementBudgetEnabled'),rows:Array.from({length:6},(_value,index)=>({attribute:index+1,value:table[index+1]}))};}
  static async save(_event,_form,data){
    if(!game.user.isGM)throw Error(game.i18n.localize('VIT.NoPermission'));
    const table=[0,...Array.from({length:6},(_value,index)=>Number(data.object[`movement${index+1}`]))];
    if(table.some(value=>!Number.isFinite(value)||value<0))throw Error(game.i18n.localize('VIT.InvalidCheck'));
    await game.settings.set('vitruviy','movementTable',table);
    await game.settings.set('vitruviy','movementBudgetEnabled',!!data.object.enabled);
  }
}
export function registerMovementBudget(){
  game.settings.register('vitruviy','movementTable',{scope:'world',config:false,type:Array,default:DEFAULT_MOVEMENT});
  game.settings.register('vitruviy','movementBudgetEnabled',{scope:'world',config:false,type:Boolean,default:true});
  installMovementRuler();
}
