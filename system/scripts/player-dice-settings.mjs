import {t} from './rolls.mjs';
import {registerPlayerDice,validateDiceProfile} from './player-dice.mjs';
export class PlayerDiceSettings extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2){
  static DEFAULT_OPTIONS={id:'wind-player-dice',classes:['vitruviy'],tag:'form',position:{width:600,height:700},window:{title:'VIT.PlayerDice',resizable:true},form:{closeOnSubmit:true,handler:this.save}};
  static PARTS={body:{template:'systems/vitruviy/templates/player-dice.hbs',scrollable:['.vit-player-dice-list']}};
  async _prepareContext(){const profiles=game.settings.get('vitruviy','playerDice')??{};return {styles:{default:t('DefaultDice'),red:t('DiceRed'),numeric:t('DiceNumeric'),custom:t('DiceCustom')},users:game.users.map(user=>({id:user.id,name:user.name,style:profiles[user.id]?.style??'default',faces:Array.from({length:6},(_value,index)=>({number:index+1,userId:user.id,value:profiles[user.id]?.faces?.[index]??''}))}))};}
  static async save(_event,_form,data){
    if(!game.user.isGM)throw Error(t('NoPermission'));
    const profiles={};
    for(const user of game.users){const style=data.object[`style${user.id}`];if(style==='default')continue;
      profiles[user.id]=validateDiceProfile({style,faces:Array.from({length:6},(_value,index)=>String(data.object[`face${user.id}_${index+1}`]??'').trim())});}
    await game.settings.set('vitruviy','playerDice',profiles);
  }
}
export function registerPlayerDiceSettings(){
  game.settings.register('vitruviy','playerDice',{scope:'world',config:false,type:Object,default:{},onChange:()=>registerPlayerDice().catch(error=>ui.notifications.error(error.message))});
}
