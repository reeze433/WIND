import {ATTRIBUTES} from "./dice.mjs";
import {t, rollAttribute} from "./rolls.mjs";
export async function installIntegrations() {
  if (!game.modules.get("monks-tokenbar")?.active) return;
  try {
    const [{BaseRolls}, {MonksTokenBar}] = await Promise.all([
      import("/modules/monks-tokenbar/systems/base-rolls.js"), import("/modules/monks-tokenbar/monks-tokenbar.js")
    ]);
    class VitruviyTokenBar extends BaseRolls {
      constructor() { super(); this._requestoptions = [{id: "attribute", text: t("Attributes"), groups: Object.fromEntries(ATTRIBUTES.map(k => [k, t(k)]))}]; }
      get _supportedSystem() { return true; }
      get canReroll() { return false; }
      get showXP() { return false; }
      get showAdvantage() { return false; }
      getButtons() { return super.getButtons().map(group => group.filter(b => !["contested-roll", "assign-xp"].includes(b.id))).filter(group => group.length); }
      get defaultStats() { return [{stat: "system.health.value", icon: "fas fa-heart"}, {stat: "system.inspiration.value", icon: "fas fa-star"}]; }
      getValue(actor, type, key) { return type === "attribute" ? actor.system.attributes[key] : null; }
      defaultRequest() { return "attribute:attention"; }
      defaultContested() { return "attribute:combat"; }
      async roll({id, actor, request, rollMode, fastForward}, callback) {
        try {
          if (request.type !== "attribute") throw new Error(t("InvalidCheck"));
          const result = await rollAttribute(actor, request.key, {chatMessage: false, fastForward, rollMode});
          if (!result) return {id, error: true, msg: t("Cancelled")};
          // TokenBar compares Roll.total; provide successes, never the sum of d6.
          const roll = await new Roll(String(result.total)).evaluate();
          const {rolls, ...snapshot} = result;
          roll.options.vitruviy = snapshot;
          return callback(roll);
        } catch (error) { return {id, error: true, msg: error.message}; }
      }
    }
    MonksTokenBar.system = new VitruviyTokenBar();
    if (MonksTokenBar.tokenbar) MonksTokenBar.tokenbar.buttons = MonksTokenBar.system.getButtons();
    await MonksTokenBar.tokenbar?.render(true);
    game.vitruviy.integrations.tokenbar = true;
  } catch (error) { console.error("Wind | TokenBar adapter", error); ui.notifications.warn(t("TokenBarUnavailable")); }
}
