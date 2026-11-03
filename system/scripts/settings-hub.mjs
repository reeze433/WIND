import {DEFAULT_INSPIRATION_MESSAGES} from './inspiration-chat.mjs';
import {CustomizationSettings} from './customization.mjs';
import {CustomResourceSettings} from './custom-resources.mjs';
import {PlayerDiceSettings} from './player-dice-settings.mjs';
import {MovementSettings} from './movement-settings.mjs';
import {cardDefaults,GRID_LIMIT_CHOICES,CARD_WIDTH_CHOICES} from './card-defaults.mjs';
import {categoryLabel} from './cards.mjs';
import {hubSettingPlan} from './settings-plan.mjs';
import {setChangedSetting} from './settings-utils.mjs';
const sections=['rules','movement','cards','appearance','resources','dice'];
export class WindSettings extends CustomizationSettings{
 static DEFAULT_OPTIONS={id:'wind-settings',classes:['vitruviy','wind-settings'],tag:'form',position:{width:820,height:720},window:{title:'VIT.WindSettings',resizable:true},form:{closeOnSubmit:true,handler:this.save},actions:{settingsTab:this.onTab,resourceSettings:this.onResources,playerDiceSettings:this.onPlayerDice,movementSettings:this.onMovement}};
 static PARTS={body:{template:'systems/vitruviy/templates/settings-hub.hbs',scrollable:['.wind-settings-content']}};
 async _prepareContext(){
  const context=await super._prepareContext(),get=key=>game.settings.get('vitruviy',key),defaults=cardDefaults();
  const select=key=>{const registration=game.settings.settings.get(`vitruviy.${key}`);return Object.entries(registration.choices).map(([value,label])=>({value,label:game.i18n.localize(label),selected:value===get(key)}));};
  return {...context,responseOptions:select('responseRollVisibility'),inspirationMessages:Object.entries(DEFAULT_INSPIRATION_MESSAGES).map(([key,value])=>({key,label:game.i18n.localize(`VIT.InspirationTemplate_${key}`),value:get('inspirationMessages')?.[key]??value})),cardLayoutOptions:select('cardLayout'),tabs:sections.map(id=>({id,label:game.i18n.localize(`VIT.Settings_${id}`),active:id===(this._section??'rules')})),healthPerWellbeing:get('healthPerWellbeing'),criticalOnDoubleSuccess:get('criticalOnDoubleSuccess'),initiativeOptions:select('initiativeAttribute'),movementOptions:select('movementUnits'),customPanelName:get('customPanelName'),cardGridOpacity:get('cardGridOpacity'),themeOptions:select('theme'),fontOptions:select('fontPreset'),widths:CARD_WIDTH_CHOICES.map(value=>({value,label:`${value} × 6`,selected:value===defaults.gridWidth})),panels:['ability','equipment','custom'].map(type=>({type,label:categoryLabel(type),sizes:GRID_LIMIT_CHOICES.map(value=>({value,label:`${value} × ${value}`,selected:value===defaults.grids[type]}))}))};
 }
 _onRender(context,options){super._onRender(context,options);this.selectSection(this._section??'rules');
  const opacity=this.element.querySelector('[name="cardGridOpacity"]');opacity?.addEventListener('input',()=>{opacity.parentElement.querySelector('output').value=`${opacity.value}%`;});
  this.element.querySelector('.wind-settings-nav').addEventListener('keydown',event=>{const tabs=[...this.element.querySelectorAll('[data-settings-tab]')],index=tabs.indexOf(event.target);if(index<0)return;const next={ArrowDown:(index+1)%tabs.length,ArrowUp:(index+tabs.length-1)%tabs.length,Home:0,End:tabs.length-1}[event.key];if(next===undefined)return;event.preventDefault();this.selectSection(tabs[next].dataset.settingsTab);tabs[next].focus();});
 }
 selectSection(id){if(!sections.includes(id))return;this._section=id;for(const panel of this.element.querySelectorAll('[data-settings-section]'))panel.hidden=panel.dataset.settingsSection!==id;for(const tab of this.element.querySelectorAll('[data-settings-tab]')){tab.setAttribute('aria-selected',String(tab.dataset.settingsTab===id));tab.tabIndex=tab.dataset.settingsTab===id?0:-1;}}
 static onTab(_event,target){this.selectSection(target.dataset.settingsTab);}
 static onResources(){new CustomResourceSettings().render(true);}
 static onPlayerDice(){new PlayerDiceSettings().render(true);}
 static onMovement(){new MovementSettings().render(true);}
 static async save(event,form,data){
  if(!game.user.isGM)throw Error(game.i18n.localize('VIT.NoPermission'));
  let plan;try{plan=hubSettingPlan(data.object);}catch(error){throw Error(game.i18n.localize(error.message));}
  // Validate the whole form before changing rules; the customization handler validates its own files and currency IDs.
  await CustomizationSettings.save(event,form,data);
  for(const [key,value]of Object.entries(plan))await setChangedSetting(key,value);
 }
}
export function registerSettingsHub(){game.settings.registerMenu('vitruviy','settings',{name:'VIT.WindSettings',label:'VIT.OpenWindSettings',hint:'VIT.WindSettingsHint',icon:'fa-solid fa-sliders',type:WindSettings,restricted:true});}
