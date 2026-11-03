import {checkedUpdate} from './document-writes.mjs';
import {t, escape} from "./rolls.mjs";
export function activeInspirationRecipients(){
  return [...game.users].filter(user=>user.active&&!user.isGM&&user.character?.type==='character').map(user=>({userId:user.id,actor:user.character,label:`${user.character.name} (${user.name})`})).sort((a,b)=>a.label.localeCompare(b.label,'ru'));
}
let pending = false;
export async function grantInspiration() {
  if (!game.user.isGM) throw new Error(t("GMOnlyInspiration"));
  if (pending) return;
  pending = true;
  try {
    const actors = activeInspirationRecipients();
    if (!actors.length) return ui.notifications.warn(t("NoActivePlayers"));
    const values = await foundry.applications.api.DialogV2.prompt({classes:["vitruviy","vit-dialog"],window: {title: t("GrantInspiration")},
      content: `<div class="vit-roll-form"><label>${t("Character")}<select name="userId">${actors.map(entry => `<option value="${escape(entry.userId)}">${escape(entry.label)}</option>`).join("")}</select></label><label>${t("Quantity")}<input name="amount" type="number" value="1" min="1" max="100" step="1" required></label></div>`,
      ok: {label: t("Grant"), callback: (_event, button) => Object.fromEntries(new FormData(button.form))}, rejectClose: false});
    if (!values) return;
    if (!game.user.isGM) throw new Error(t("GMOnlyInspiration"));
    const original=actors.find(entry=>entry.userId===values.userId),recipient=activeInspirationRecipients().find(entry=>entry.userId===values.userId);
    const actor = recipient?.actor, amount = Number(values.amount);
    if(!original||original.actor.uuid!==actor?.uuid)throw Error(t("RecipientDisconnected"));
    if (!actor || actor.type !== "character" || !Number.isInteger(amount) || amount < 1 || amount > 100) throw new Error(t("InvalidCheck"));
    const next=actor.system.inspiration.value+amount;if(!Number.isSafeInteger(next))throw Error(t("InvalidCheck"));
    await checkedUpdate(actor,{"system.inspiration.value": next});
    ui.notifications.info(`${actor.name}: +${amount} ${t("Inspiration")}`);
    return actor;
  } finally { pending = false; }
}
export async function ensureInspirationMacro() {
  if (!game.user.isGM || game.user !== game.users.activeGM) return;
  const ownership = {default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE};
  for (const user of game.users) if (user.isGM) ownership[user.id] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
  const macro = game.macros.find(macro => (macro.getFlag("vitruviy", "libraryMacro")==="grant"||macro.getFlag("vitruviy", "grantInspiration")));
  if (macro) {
    if(macro.name!==t("GrantInspiration"))await macro.update({name:t("GrantInspiration")});
    if (JSON.stringify(macro.ownership) !== JSON.stringify(ownership)) await macro.update({ownership}, {recursive: false});
    if (macro.img === "icons/svg/coin.svg") await macro.update({img: "icons/svg/coins.svg"});
    return macro;
  }
  return Macro.create({name: t("GrantInspiration"), type: "script", img: "icons/svg/coins.svg",
    command: "await game.vitruviy.grantInspiration();", ownership, flags: {vitruviy: {grantInspiration: true}}});
}

