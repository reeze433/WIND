import {registerAutoBlood,toggleAutoBlood} from './auto-blood.mjs';
import {randomTile} from './random-tile.mjs';
import {captureInspirationChange,announceInspirationChange} from './inspiration-chat.mjs';
import {addAreaControls} from './item-area.mjs';
import {registerMovementBudget} from './movement-settings.mjs';
import {registerPlayerDiceSettings} from './player-dice-settings.mjs';
import {addTargetControls} from './targets.mjs';
import {rest} from './rest.mjs';
import {setInitiativeAttribute,chooseAndRollInitiative} from './macros.mjs';
import {registerResourceOperations} from './operations.mjs';
import {registerCustomResources} from './custom-resources.mjs';
import {registerItemEffects} from './item-effects.mjs';
import {registerCurrencyTransfers} from './currency.mjs';
import {addChargeControls,refreshChargeControls} from './charges.mjs';
import {registerWound,ensureConditionCatalog,syncZeroHealth,syncWound,applyConditionCatalog} from './conditions.mjs';
import './hud.mjs';
import {UniversalItem} from './item-document.mjs';
import './item-piles.mjs';
import {registerDice} from './dice3d.mjs';
import {spendInspiration,toggleItemInspiration,addResourceControls,refreshResourceControls} from './resources.mjs';
import {ensureMacroLibrary,selectedActor,macroAction,combatAction} from './macros.mjs';
import {registerSettings, healthMultiplier} from "./settings.mjs";
import {installTokenFonts} from './token-fonts.mjs';
import {CharacterData, CardData} from "./models.mjs";
import {VitruviyActorSheet, VitruviyItemSheet} from "./sheets.mjs";
import {rollAttribute, evaluateCheck, canIncreaseInspiration, t, escape} from "./rolls.mjs";
import {refreshPresentation,styleHiddenRoll} from "./presentation.mjs";
import {fixTokenVision, configureHealthHover, repairHealthEstimate} from "./vision.mjs";
import {rollItem,addActionControls} from "./items.mjs";
import {applyDamage, addDamageControls} from "./damage.mjs";
import {rollCoin} from "./coin.mjs";
import {grantInspiration} from "./inspiration.mjs";
import {ATTRIBUTES} from "./dice.mjs";
import {installIntegrations} from "./integrations.mjs";
import {rollSuccessDice, addChatDice} from "./chat-dice.mjs";
Hooks.once("init", () => {
  CONFIG.Actor.dataModels = {character: CharacterData, npc: CharacterData};
  CONFIG.Item.documentClass=UniversalItem;
  CONFIG.Item.dataModels = {card:CardData, trait: CardData, ability: CardData, equipment: CardData, condition: CardData, other: CardData};
  CONFIG.Actor.typeLabels = {character: "VIT.character", npc: "VIT.npc"};
  CONFIG.Item.typeLabels = Object.fromEntries(["card","trait", "ability", "equipment", "condition", "other"].map(k => [k, `VIT.${k}`]));
  CONFIG.VITRUVIY = {attributes: Object.fromEntries(ATTRIBUTES.map(k => [k, `VIT.${k}`]))};
  foundry.documents.collections.Actors.registerSheet("vitruviy", VitruviyActorSheet, {label:'VIT.CharacterSheet',types: ["character", "npc"], makeDefault: true});
  foundry.documents.collections.Items.registerSheet("vitruviy", VitruviyItemSheet, {label:'VIT.ItemSheet',types: ["card","trait", "ability", "equipment", "condition", "other"], makeDefault: true});
  registerResourceOperations();
  registerSettings();
  registerAutoBlood();
  registerMovementBudget();
  registerPlayerDiceSettings();
  registerCustomResources();
  installTokenFonts();
  registerWound();
  CONFIG.Actor.trackableAttributes = {character: {bar: ["health"], value: ["inspiration.value", "experience.value"]}, npc: {bar: ["health"], value: ["inspiration.value"]}};
  game.vitruviy = {toggleAutoBlood,randomTile,chooseAndRollInitiative,rest,setInitiativeAttribute,spendInspiration,toggleItemInspiration,selectedActor,macroAction,combatAction,repairHealthEstimate,rollAttribute, rollItem, applyDamage, rollCoin, rollSuccessDice, evaluateCheck, grantInspiration, fixTokenVision, integrations: {tokenbar: false}, schemaVersion: 3};
  game.wind=game.vitruviy;
  CONFIG.WIND=CONFIG.VITRUVIY;
});
Hooks.on("preCreateActor", actor => {
  if (!actor.parent) actor.updateSource({"prototypeToken.actorLink": actor.type === "character", "prototypeToken.bar1.attribute": "health", ...(actor.type === "character" ? {"prototypeToken.sight.enabled": true} : {})});
});
Hooks.on("preUpdateActor", (actor, changes, options) => {
  if(captureInspirationChange(actor,changes,options)===false){ui.notifications.warn(t("InvalidCheck"));return false;}
  const flat = foundry.utils.flattenObject(changes);
  if (Object.entries(flat).some(([key, value]) => key.startsWith("system.currencies.") && (!Number.isSafeInteger(Number(value)) || Number(value) < 0))) {
    ui.notifications.warn(t("InvalidCurrencyValue")); return false;
  }
  if ("system.inspiration.value" in flat && Number(flat["system.inspiration.value"]) > actor.system.inspiration.value
    && !canIncreaseInspiration(actor, Number(flat["system.inspiration.value"]), options)) {
    ui.notifications.warn(t("GMOnlyInspiration"));
    return false;
  }
  if ("system.inspiration.value" in flat && Number(flat["system.inspiration.value"]) < actor.system.inspiration.value) {
    options.vitruviyInspirationSpent = actor.system.inspiration.value - Number(flat["system.inspiration.value"]);
    options.vitruviyInspirationUseId=options.vitruviyResourceUseId??foundry.utils.randomID();
    if(!options.vitruviyResourceUseId){
      changes.flags??={};changes.flags.vitruviy??={};changes.flags.vitruviy.resourceUses??={};
      changes.flags.vitruviy.resourceUses[options.vitruviyInspirationUseId]=true;
    }
  }
  if ("system.attributes.wellbeing" in flat) {
    const activeBonus=actor.system.attributes.wellbeing-Number(actor._source.system.attributes.wellbeing);
    const maximum = Math.max(0,Number(flat["system.attributes.wellbeing"])+activeBonus) * healthMultiplier();
    const current = Number(flat["system.health.value"] ?? actor._source.system.health?.value ?? actor.system.health.value);
    changes.system ??= {}; changes.system.health ??= {};
    changes.system.health.value = Math.min(maximum, Math.max(0, current));
  }
});
Hooks.once("ready", installIntegrations);
Hooks.on("renderChatInput", addChatDice);
Hooks.on("renderChatMessageHTML", addDamageControls);
Hooks.on('updateActor',(...args)=>announceInspirationChange(...args).catch(error=>ui.notifications.error(error.message)));
Hooks.once("ready", refreshPresentation);
Hooks.once("ready", () => configureHealthHover().catch(error => ui.notifications.error(error.message)));


Hooks.once('diceSoNiceReady', registerDice);
Hooks.once('ready',()=>ensureMacroLibrary().catch(error=>ui.notifications.error(error.message)));
Hooks.on('renderChatMessageHTML',addResourceControls);
Hooks.on('updateActor',refreshResourceControls);

Hooks.once('ready',async()=>{
  if(!game.user.isGM)return;
  for(const [key,old,path] of [['coinFailureIcon','icons/svg/cancel.svg','failure'],['coinSuccessIcon','icons/svg/sun.svg','success']])if(game.settings.get('vitruviy',key)===old)await game.settings.set('vitruviy',key,`systems/vitruviy/assets/coin-${path}.svg`);
});

Hooks.once('ready', async()=>{
  await ensureConditionCatalog();
  applyConditionCatalog();
  if(game.users.activeGM?.id===game.user.id) for(const actor of game.actors) await Promise.all([syncWound(actor),syncZeroHealth(actor)]);
});
Hooks.on('renderTokenHUD',()=>ensureConditionCatalog().catch(console.error));
Hooks.on('updateActor',(actor,changes,_options,userId)=>{
  if(userId===game.user.id && (changes.system?.health || changes.system?.attributes || Object.keys(changes).some(k=>k.startsWith('system.health.')||k.startsWith('system.attributes.')))) Promise.all([syncWound(actor),syncZeroHealth(actor)]).catch(console.error);
});
for(const hook of ['createActiveEffect','updateActiveEffect','deleteActiveEffect']) Hooks.on(hook,e=>e.parent?.sheet?.render(false));
Hooks.on('updateItem',item=>{if(item.getFlag('vitruviy','statusId')) {applyConditionCatalog();} if(item.getFlag('vitruviy','statusId')) for(const actor of game.actors) if(actor.statuses.has(item.getFlag('vitruviy','statusId'))) actor.sheet?.render(false);});

Hooks.once('ready',registerCurrencyTransfers);
Hooks.on('renderChatMessageHTML',addChargeControls);
Hooks.on('updateItem',refreshChargeControls);

Hooks.once('ready',registerItemEffects);

Hooks.on('updateActor',actor=>refreshChargeControls({actor}));

Hooks.on('renderChatMessageHTML',addTargetControls);

Hooks.on('updateActor',(actor,changes)=>{for(const id of Object.keys(changes.flags?.vitruviy?.defenses??{})){const message=game.messages.get(id);if(message?.visible)ui.chat.updateMessage(message).catch(console.error);}});

Hooks.on('renderChatMessageHTML',addAreaControls);

Hooks.on('renderChatMessageHTML',styleHiddenRoll);






Hooks.on('renderChatMessageHTML',addActionControls);
import {retireRedlineWorld} from './retired-redline.mjs';
Hooks.once('ready',()=>retireRedlineWorld().catch(error=>ui.notifications.error(error.message)));
