import {cardDefaults,normalizeCardDefaults,GRID_LIMIT_CHOICES,CARD_WIDTH_CHOICES} from './card-defaults.mjs';
import {categoryLabel} from './cards.mjs';
export class CardDefaultsSettings extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2){
 static DEFAULT_OPTIONS={id:'wind-card-defaults',classes:['vitruviy'],tag:'form',position:{width:520},window:{title:'VIT.CardDefaults'},form:{closeOnSubmit:true,handler:this.save}};
 static PARTS={body:{template:'systems/vitruviy/templates/card-defaults-settings.hbs'}};
 async _prepareContext(){const config=cardDefaults();return {widths:CARD_WIDTH_CHOICES.map(value=>({value,label:`${value} × 6`,selected:value===config.gridWidth})),panels:['ability','equipment','custom'].map(type=>({type,label:categoryLabel(type),sizes:GRID_LIMIT_CHOICES.map(value=>({value,label:`${value} × ${value}`,selected:value===config.grids[type]}))}))};}
 static async save(_event,_form,data){
  if(!game.user.isGM)throw Error(game.i18n.localize('VIT.NoPermission'));
  const value={gridWidth:Number(data.object.gridWidth),grids:Object.fromEntries(['ability','equipment','custom'].map(type=>[type,Number(data.object[type])]))};
  if(!CARD_WIDTH_CHOICES.includes(value.gridWidth)||Object.values(value.grids).some(limit=>!GRID_LIMIT_CHOICES.includes(limit)))throw Error(game.i18n.localize('VIT.InvalidCheck'));
  await game.settings.set('vitruviy','cardCreationDefaults',normalizeCardDefaults(value));
 }
}
export function registerCardDefaultsSettings(){
 game.settings.register('vitruviy','cardCreationDefaults',{scope:'world',config:false,type:Object,default:normalizeCardDefaults(),onChange:()=>{for(const actor of game.actors??[])for(const app of Object.values(actor.apps??{}))app.render(false);}});
}
