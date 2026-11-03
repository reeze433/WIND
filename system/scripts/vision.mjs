import {t} from "./rolls.mjs";
export async function fixTokenVision() {
  if (!game.user.isGM) throw new Error(t("NoPermission"));
  const tokens = canvas.tokens?.controlled ?? [];
  if (!tokens.length) return ui.notifications.warn(t("SelectVisionToken"));
  await canvas.scene.update({tokenVision: true});
  await canvas.scene.updateEmbeddedDocuments("Token", tokens.map(token => ({_id: token.id, "sight.enabled": true, "sight.visionMode": "basic"})));
  for (const token of tokens) if (token.actor && token.document.actorLink) await token.actor.update({"prototypeToken.sight.enabled": true, "prototypeToken.sight.visionMode": "basic"});
  ui.notifications.info(t("VisionFixed"));
}
export async function ensureVisionMacro() {
  if (!game.user.isGM || game.user !== game.users.activeGM) return;
  const existing=game.macros.find(macro => (macro.getFlag("vitruviy", "libraryMacro")==="vision"||macro.getFlag("vitruviy", "fixTokenVision")));
  if(existing){if(existing.name!==t("FixVision"))await existing.update({name:t("FixVision")});return;}
  const ownership = {default: 0};
  for (const user of game.users) if (user.isGM) ownership[user.id] = 3;
  await Macro.create({name: t("FixVision"), type: "script", img: "icons/svg/eye.svg", ownership,
    command: "await game.vitruviy.fixTokenVision();", flags: {vitruviy: {fixTokenVision: true}}});
}
export async function configureHealthHover() {
  if (game.user.isGM && game.modules.get("healthEstimate")?.active) await repairHealthEstimate();
  if (!game.modules.get("healthEstimate")?.active || game.user.getFlag("vitruviy", "healthColorNamesConfigured")) return;
  await game.settings.set("healthEstimate", "display", "nameplate");
  await game.user.setFlag("vitruviy", "healthColorNamesConfigured", true);
}

export async function repairHealthEstimate() {
  if(!game.user.isGM)throw new Error(t('NoPermission'));
  if(!game.modules.get('healthEstimate')?.active)return ui.notifications.warn(t('HealthModuleDisabled'));
  if(game.settings.get('healthEstimate','core.custom.FractionHP')!=='actor.system.health')await game.settings.set('healthEstimate','core.custom.FractionHP','actor.system.health');
  if(game.settings.get('healthEstimate','core.custom.FractionMath')!==0)await game.settings.set('healthEstimate','core.custom.FractionMath',0);
  game.healthEstimate?.updateSettings();
  for(const token of canvas.tokens?.placeables??[])game.healthEstimate?.refreshToken?.(token);
}
