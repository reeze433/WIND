import {prepareCoinRoll} from "./dice3d.mjs";
import {t, escape} from "./rolls.mjs";
import {currentCoinAtlas} from './coin-atlas.mjs';

export function validCoinIcon(path) {
  return typeof path === "string" && /\.(?:svg|png|jpe?g|webp)$/i.test(path.trim()) && !/^(?:javascript|data|file):/i.test(path.trim());
}
export async function rollCoin({actor, messageMode = game.settings.get("core", "messageMode")} = {}) {
  if (actor && !actor.isOwner) throw new Error(t("NoPermission"));
  const roll = await new Roll("1d2").evaluate();
  try {await prepareCoinRoll(roll);} catch(error) {console.error('Wind | coin texture',error);ui.notifications.warn(t('CoinTextureError'));}
  const face = roll.total;
  if (![1, 2].includes(face)) throw new Error(t("InvalidCheck"));
  const success = face === 2;
  const atlas = await currentCoinAtlas(),icon=atlas.image;
  const label = t(success ? "CoinSuccess" : "CoinFailure");
  const message = {speaker: ChatMessage.getSpeaker(actor ? {actor} : {}), rolls: [roll],
    content: `<article class="vit-chat vit-coin-result"><header>${t("CoinFlip")}</header><div><strong>${escape(label)}</strong></div></article>`,
    flags: {vitruviy: {coin: {face, success, icon,atlas}}}};
  ChatMessage.applyMode(message, messageMode);
  await ChatMessage.create(message);
  return {face, success, icon};
}

