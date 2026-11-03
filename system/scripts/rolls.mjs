import {inspirationReceipt,inspirationText} from './inspiration-chat.mjs';
import {attributePool} from './branches.mjs';
import {randomId} from './random-id.mjs';
import {checkedUpdate} from './document-writes.mjs';
import {resourceOperation,registerResourceAction} from './operations.mjs';
import {prepareDiceRoll} from "./dice3d.mjs";
import {ATTRIBUTES, successes, selectAttempt, validateCheck} from "./dice.mjs";
export const t = key => game.i18n.localize(`VIT.${key}`);
export const escape = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;"}[c]));
const pending = new Set();
const refunds = new Map();
async function commitAttributeRoll(actor,spend,message,user=game.user){
  if(!Number.isSafeInteger(spend)||spend<0||spend>actor.system.inspiration.value)throw new Error(t('InvalidCheck'));
  const useId=randomId();
  if(message&&spend){message.flags.vitruviy.resource={actorUuid:actor.uuid,cost:spend,useId,refundOnly:true};message.author=user?.id;}
  if(message&&spend)message.content=message.content.replace("</article>",`${inspirationReceipt(actor,{kind:"spend",amount:spend,before:actor.system.inspiration.value,after:actor.system.inspiration.value-spend,userId:user?.id})}</article>`);
  if(spend)await checkedUpdate(actor,{'system.inspiration.value':actor.system.inspiration.value-spend,[`flags.vitruviy.resourceUses.${useId}`]:true},
    {vitruviyResourceUseId:useId,...(message?{vitruviyItemMessageId:useId}:{})});
  try{if(message&&!await ChatMessage.create(message))throw new Error(t('UpdateCancelled'));}
  catch(error){if(spend)await refundInspiration(actor,actor.system.inspiration.value+spend,{[`flags.vitruviy.resourceUses.${useId}`]:false},{vitruviyInspirationSilent:true});throw error;}
}
registerResourceAction('attributeRoll',async(actor,payload,user)=>{
  const raw=payload.message;
  if(raw&&!ATTRIBUTES.includes(raw.flags?.vitruviy?.check?.attribute))throw new Error(t('InvalidCheck'));
  const message=raw?{speaker:ChatMessage.getSpeaker({actor}),content:raw.content,rolls:(raw.rolls??[]).map(data=>Roll.fromData(data)),
    ...(raw.whisper?{whisper:raw.whisper}:{}),...(raw.blind?{blind:true}:{}),flags:{vitruviy:{check:raw.flags.vitruviy.check}}}:null;
  return commitAttributeRoll(actor,payload.spend,message,user);
});
export function canIncreaseInspiration(actor, value, options = {}) {
  return !!game.user?.isGM || (options.vitruviyInspirationRefund === true && refunds.get(actor.uuid) === value);
}
export async function evaluateCheck(options) {
  const params = validateCheck(options), attempts = [], rolls = [];
  for (let i = 0; i <= params.repeats; i++) {
    const roll = await new Roll(params.pool ? `${params.pool}d6` : "0").evaluate();
    prepareDiceRoll(roll);
    const faces = roll.dice.flatMap(d => d.results.filter(r => r.active !== false).map(r => r.result));
    attempts.push({faces, symbols: faces.map(successes), total: faces.reduce((s, f) => s + successes(f), 0)});
    rolls.push(roll);
  }
  const selected = selectAttempt(attempts, params.mode);
  const critical = game.settings.get('vitruviy', 'criticalOnDoubleSuccess') === true && attempts[selected].faces.includes(6);
  return {...params, attempts, selected, total: attempts[selected].total, critical, rolls};
}
export function checkHTML(result, label, _action = "", {description = "", descriptionHTML = null, damage = null, modifier = 0, tier = "", hasTier = true, img = "",quantity=1} = {}) {
  return `<article class="vit-chat"><header>${img ? `<img class="vit-chat-item-icon" src="${escape(img)}" alt="">` : ""}${escape(label)} | ${t(result.mode)}</header>${quantity>1?`<p class="vit-card-quantity">${t('Quantity')}: ${quantity}</p>`:''}${descriptionHTML !== null ? `<div class="vit-public-description vit-item-rich">${descriptionHTML}</div>` : description ? `<p class="vit-public-description">${escape(description)}</p>` : ""}
    ${result.attempts.map((a, i) => `<div class="vit-attempt ${i === result.selected ? "chosen" : ""}"><div>${a.symbols.map((s, j) => `<b class="vit-die" title="d6: ${a.faces[j]}">${s ? "◆".repeat(s) : "—"}</b>`).join("") || t("ZeroPool")}</div></div>`).join("")}
    <footer class="vit-result-summary"><span class="vit-result-stat">${t("Successes")}: <strong class="vit-result-number">${result.total}</strong>${result.critical ? ` <b class="vit-critical">${t('Critical')}</b>` : ''}</span>${damage !== null ? `<span class="vit-item-damage">${t("Value")}: <strong class="vit-result-number">${damage}</strong> <small>(${result.total} × ${modifier}${hasTier ? `; ${t("Tier")} ${escape(tier)}` : ""})</small></span>` : ""}</footer></article>`;
}
export async function rollAttribute(actor, attribute, options = {}) {
  if (!actor.isOwner) throw new Error(t("NoPermission"));
  if (!ATTRIBUTES.includes(attribute)) throw new Error(t("InvalidCheck"));
  const lock = actor.uuid;
  if (pending.has(lock)) return null;
  pending.add(lock);
  try {
    let values = options;
    if (!options.fastForward) {
      values = await foundry.applications.api.DialogV2.prompt({classes:["vitruviy","vit-dialog"],
        window: {title: `${actor.name} · ${t(attribute)}`},
        content: `<div class="vit-roll-form">
          ${options.contextHTML??''}
          ${options.chooseBranch?`<label>${t('RollBranch')}<select name="branch">${['base','attack','defense'].map(branch=>`<option value="${branch}" ${branch===(options.branch??'base')?'selected':''}>${t(branch==='base'?'BaseAttribute':branch==='attack'?'Attack':'Defense')} (${attributePool(actor,attribute,branch)})</option>`).join('')}</select></label>`:''}
          ${options.inspirationEnabled ? `<label>${t("UseInspiration")} (${Number(options.inspirationCost??1)})<input type="checkbox" name="useInspiration" checked></label>` : ""}
          <label>${t("Mode")}<select name="mode"><option value="disadvantage" ${options.mode==='disadvantage'?'selected':''}>${t("disadvantage")}</option><option value="normal" ${!options.mode||options.mode==='normal'?'selected':''}>${t("normal")}</option><option value="advantage" ${options.mode==='advantage'?'selected':''}>${t("advantage")}</option></select></label>
          <label>${t("RollMode")}<select name="rollMode"><option value="public">${t("Public")}</option><option value="gm" ${["gm", "blind", "self"].includes(game.settings.get("core", "messageMode")) ? "selected" : ""}>${t("Hidden")}</option></select></label></div>`,
        ok: {label: t("Roll"), callback: (_event, button) => Object.fromEntries(new FormData(button.form))}, rejectClose: false
      });
      if (!values) return null;
    }
    if (!actor.isOwner) throw new Error(t("NoPermission"));
    const branch=options.chooseBranch?(values.branch??options.branch??'base'):(options.branch??'base');
    if(!['base','attack','defense'].includes(branch))throw Error(t('InvalidCheck'));
    await options.validateForm?.(values);
    const useInspiration = options.inspirationEnabled && (options.fastForward ? options.useInspiration !== false : values.useInspiration === "on");
    if(useInspiration && Number(options.inspirationCost??0)>actor.system.inspiration.value)throw new Error(t('NotEnoughInspiration'));
    const spend = Number(values.spend ?? 0), bonus = Number(values.bonus ?? 0);
    if (!Number.isInteger(spend) || spend < 0 || spend > actor.system.inspiration.value || !Number.isInteger(bonus) || bonus < 0) throw new Error(t("InvalidCheck"));
    const result = await evaluateCheck({pool: attributePool(actor,attribute,branch) + bonus, mode: values.mode ?? "normal", repeats: Number(values.repeats ?? (values.mode && values.mode !== "normal" ? 1 : 0)), difficulty: values.difficulty === "" || values.difficulty == null ? null : Number(values.difficulty)});
    result.branch=branch;
    result.useInspiration = useInspiration;
    result.messageMode = ({publicroll:"public",gmroll:"gm",blindroll:"blind",selfroll:"self"})[values.rollMode] ?? values.rollMode ?? game.settings.get("core", "messageMode");
    let message=null;
    if (options.chatMessage !== false) {
        const {rolls, ...snapshot} = result;
        message = {speaker: ChatMessage.getSpeaker({actor}), content: checkHTML(result, `${t(attribute)}${branch==='base'?'':' - '+t(branch==='attack'?'Attack':'Defense')}`),
          rolls, flags: {vitruviy: {check: {...snapshot, attribute, action: values.action ?? "", inspirationSpent: spend}}}};
        ChatMessage.applyMode(message, result.messageMode);
    }
    if(spend)await resourceOperation(actor,'attributeRoll',{spend,message:message?{...message,rolls:message.rolls.map(roll=>roll.toJSON?.()??roll)}:null},()=>commitAttributeRoll(actor,spend,message));
    else if(message&&!await ChatMessage.create(message))throw new Error(t('UpdateCancelled'));
    return result;
  } finally { pending.delete(lock); }
}

export async function refundInspiration(actor, value, changes = {}, options = {}) {
  if (!actor?.isOwner) throw new Error(t("NoPermission"));
  refunds.set(actor.uuid, value);
  try { return await checkedUpdate(actor,{...changes, "system.inspiration.value": value}, {...options,vitruviyInspirationRefund: true}); }
  finally { refunds.delete(actor.uuid); }
}
