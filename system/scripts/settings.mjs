import {DEFAULT_INSPIRATION_MESSAGES} from './inspiration-chat.mjs';
import {registerSettingsHub} from './settings-hub.mjs';
import {scheduleSheetRefresh} from './settings-utils.mjs';
import {registerCardDefaultsSettings} from './card-defaults-settings.mjs';
import {ATTRIBUTES} from "./dice.mjs";
import {registerMovementSettings} from './movement.mjs';
import {CustomizationSettings} from "./customization.mjs";
import {refreshPresentation,DEFAULT_HEADER_BACKGROUNDS} from "./presentation.mjs";
import {evaluateCheck, checkHTML, t} from "./rolls.mjs";
import {refreshCoinDice} from './dice3d.mjs';
import {DEFAULT_COIN_ATLAS} from './coin-atlas.mjs';
const refreshCoin = () => refreshCoinDice().catch(error=>{console.error('Wind | coin texture',error);ui.notifications.warn(t('CoinTextureError'));});
export function healthMultiplier() { return game.settings.get("vitruviy", "healthPerWellbeing") ?? 5; }
async function refreshHealth() {
  const actors = new Set([...game.actors, ...(canvas.tokens?.placeables ?? []).map(token => token.actor).filter(Boolean)]);
  for (const actor of actors) {
    actor.prepareData();
    if (game.user === game.users.activeGM && actor._source.system.health.value > actor.system.health.max) await actor.update({"system.health.value": actor.system.health.max});
    for (const app of Object.values(actor.apps)) app.render(false);
  }
  for (const token of canvas.tokens?.placeables ?? []) token.renderFlags.set({refreshBars: true});
}
export function installCombat() {
  const BaseCombat = CONFIG.Combat.documentClass;
  CONFIG.Combat.documentClass = class VitruviyCombat extends BaseCombat {
    async startCombat() {
      // Preserve rolls made by players before the GM starts the encounter.
      await this.rollAll({updateTurn: false});
      return super.startCombat();
    }
    async rollInitiative(ids, {updateTurn = true, messageMode, messageOptions = {}, attribute: chosenAttribute} = {}) {
      ids = typeof ids === "string" ? [ids] : ids;
      const attribute = chosenAttribute??game.settings.get("vitruviy", "initiativeAttribute");
      if(!ATTRIBUTES.includes(attribute))throw Error(t("InvalidCheck"));
      const updates = [], messages = [];
      for (const id of ids) {
        const combatant = this.combatants.get(id);
        if (!combatant?.isOwner || !combatant.actor?.system.attributes) continue;
        const result = await evaluateCheck({pool: combatant.actor.system.attributes[attribute]});
        updates.push({_id: id, initiative: result.total});
        const {rolls, ...snapshot} = result;
        const message = {...messageOptions, speaker: ChatMessage.getSpeaker({actor: combatant.actor, token: combatant.token, alias: combatant.name}),
          rolls, content: checkHTML(result, `${t("Initiative")} · ${t(attribute)}`),
          flags: foundry.utils.mergeObject(messageOptions.flags ?? {}, {core: {initiativeRoll: true}, vitruviy: {check: {...snapshot, initiative: true, attribute}}}, {inplace: false})};
        ChatMessage.applyMode(message, combatant.hidden ? "gm" : (messageMode ?? game.settings.get("core", "messageMode")));
        if (messages.length) message.sound = null;
        messages.push(message);
      }
      if (!updates.length) return this;
      const updateOptions = {turnEvents: false};
      if (!updateTurn) updateOptions.combatTurn = this.turn;
      await this.updateEmbeddedDocuments("Combatant", updates, updateOptions);
      await ChatMessage.create(messages);
      return this;
    }
  };
}
export function registerSettings() {
  registerSettingsHub();
  game.settings.register('vitruviy','inspirationMessages',{scope:'world',config:false,type:Object,default:DEFAULT_INSPIRATION_MESSAGES});
  game.settings.register('vitruviy','responseRollVisibility',{scope:'world',config:false,type:String,choices:{public:'VIT.ResponsePublic',gm:'VIT.ResponseGMOnly'},default:'public',onChange:()=>{for(const message of game.messages??[])if(message.visible&&message.getFlag('vitruviy','item'))ui.chat.updateMessage(message).catch(console.error);}});
  registerCardDefaultsSettings();
  registerMovementSettings();
  const refreshSheets=scheduleSheetRefresh;
  game.settings.register('vitruviy','cardLayout',{name:'VIT.CardLayout',scope:'world',config:false,type:String,choices:{grid:'VIT.CardLayoutGrid',list:'VIT.CardLayoutList'},default:'list',onChange:refreshSheets});
  game.settings.register('vitruviy','customPanelName',{name:'VIT.CustomPanelName',hint:'VIT.CustomPanelNameHint',scope:'world',config:false,type:String,default:'Кастом',onChange:refreshSheets});
  game.settings.register('vitruviy','cardGridOpacity',{name:'VIT.CardGridOpacity',hint:'VIT.CardGridOpacityHint',scope:'world',config:false,type:Number,range:{min:0,max:100,step:5},default:25,onChange:refreshSheets});
  game.settings.register('vitruviy','fontPreset',{name:'VIT.FontPreset',hint:'VIT.FontPresetHint',scope:'world',config:false,type:String,choices:{theme:'VIT.FontByTheme',standard:'VIT.FontStandard',exo2:'Exo 2',russoone:'Russo One'},default:'theme',onChange:refreshPresentation});
  game.settings.register("vitruviy","headerBackgrounds",{scope:"world",config:false,type:Object,default:DEFAULT_HEADER_BACKGROUNDS,onChange:refreshPresentation});
  game.settings.register('vitruviy','coinAtlas',{scope:'world',config:false,type:String,default:DEFAULT_COIN_ATLAS});
  game.settings.register('vitruviy','coinAtlasTexture',{scope:'world',config:false,type:String,default:DEFAULT_COIN_ATLAS,onChange:refreshCoin});
  game.settings.register('vitruviy','criticalOnDoubleSuccess',{name:'VIT.CriticalOnDoubleSuccess',hint:'VIT.CriticalHint',scope:'world',config:false,type:Boolean,default:false});
  game.settings.register('vitruviy','diceStyle',{scope:'world',config:false,type:String,default:'red'});
  game.settings.register('vitruviy','diceFaces',{scope:'world',config:false,type:Array,default:[]});

  game.settings.register("vitruviy", "theme", {name: "VIT.Theme", scope: "world", config: false, type: String, choices: {standard: "VIT.ThemeStandard", starwars: "VIT.ThemeStarWars", cyberpunk: "VIT.ThemeCyberpunk", jujutsu: "VIT.ThemeJujutsu"}, default: "standard", onChange: refreshPresentation});
  game.settings.register("vitruviy", "currencyTypes", {scope: "world", config: false, type: Array, default: [{id: "currency", name: "Валюта"}], onChange: refreshPresentation});
  game.settings.register("vitruviy", "coinFailureIcon", {scope: "world", config: false, type: String, default: "systems/vitruviy/assets/coin-failure.svg",onChange:refreshCoin});
  game.settings.register("vitruviy", "coinSuccessIcon", {scope: "world", config: false, type: String, default: "systems/vitruviy/assets/coin-success.svg",onChange:refreshCoin});
  game.settings.register("vitruviy", "initiativeAttribute", {name: "VIT.InitiativeAttribute", hint: "VIT.InitiativeHint", scope: "world", config: false, type: String, choices: Object.fromEntries(ATTRIBUTES.map(key => [key, `VIT.${key}`])), default: "combat"});
  game.settings.register("vitruviy", "healthPerWellbeing", {name: "VIT.HealthMultiplier", hint: "VIT.HealthMultiplierHint", scope: "world", config: false, type: new foundry.data.fields.NumberField({required: true, nullable: false, integer: true, min: 0, initial: 5}), default: 5,
    onChange: refreshHealth});
  // Core initiative controls all delegate to rollInitiative above: single, NPC and all.
  installCombat();
}


