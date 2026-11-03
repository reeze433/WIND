import {evaluateCheck, checkHTML, t} from "./rolls.mjs";
import {rollCoin} from "./coin.mjs";

export async function rollSuccessDice(pool, {messageMode = game.settings.get("core", "messageMode"), mode = "normal"} = {}) {
  const count = Number(pool);
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new Error(t("InvalidCheck"));
  const result = await evaluateCheck({pool: count, mode, repeats: mode === "normal" ? 0 : 1});
  const {rolls, ...snapshot} = result;
  const message = {speaker: ChatMessage.getSpeaker(), rolls,
    content: checkHTML(result, t("SuccessDie")), flags: {vitruviy: {check: {...snapshot, custom: true}}}};
  ChatMessage.applyMode(message, messageMode);
  await ChatMessage.create(message);
  return result;
}

export function addChatDice(_app, elements) {
  const controls = elements["#chat-controls"];
  if (!controls || controls.querySelector(".vit-chat-dice")) return;
  const toolbar = document.createElement("div");
  toolbar.className = "vit-chat-dice";
  const input = document.createElement("input");
  input.type = "number"; input.min = "1"; input.max = "100"; input.step = "1"; input.value = "1";
  input.setAttribute("aria-label", t("DiceCount")); input.title = t("DiceCount");
  const button = document.createElement("button");
  button.type = "button"; button.className = "vit-success-roll"; button.innerHTML = '<i class="fa-solid fa-dice-d6" aria-hidden="true"></i>'; button.title = t("SuccessDie"); button.setAttribute("aria-label", t("SuccessDie"));
  button.addEventListener("click", async () => {
    if (button.disabled) return;
    button.disabled = true;
    try { await rollSuccessDice(input.value, {mode}); }
    catch (error) { ui.notifications.error(error.message); }
    finally { button.disabled = false; }
  });
  input.addEventListener("keydown", event => {
    if (event.key === "Enter") { event.preventDefault(); event.stopPropagation(); button.click(); }
  });
  let mode = "normal";
  const toggles = ["advantage", "disadvantage"].map(key => {
    const toggle = document.createElement("button");
    toggle.type = "button"; toggle.className = "vit-dice-toggle";
    toggle.textContent = t(key); toggle.setAttribute("aria-pressed", "false");
    toggle.addEventListener("click", () => {
      mode = mode === key ? "normal" : key;
      toggles.forEach((other, i) => other.setAttribute("aria-pressed", String(mode === ["advantage", "disadvantage"][i])));
    });
    return toggle;
  });
  const coin = document.createElement("button");
  coin.type = "button"; coin.className = "vit-coin-flip"; coin.textContent = t("CoinFlip");
  coin.addEventListener("click", async () => {
    if (coin.disabled) return;
    coin.disabled = true;
    try { await rollCoin(); } catch (error) { ui.notifications.error(error.message); }
    finally { coin.disabled = false; }
  });
  toolbar.append(button, input, ...toggles, coin);
  controls.prepend(toolbar);
}

