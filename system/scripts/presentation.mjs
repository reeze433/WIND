import {t,escape} from './rolls.mjs';
import {resolveFontPreset} from './fonts.mjs';
import {refreshTokenFonts} from './token-fonts.mjs';
export const DEFAULT_HEADER_BACKGROUNDS = {starwars:'systems/vitruviy/assets/header-starwars.jpg',cyberpunk:'systems/vitruviy/assets/header-code-red.jpg',jujutsu:'systems/vitruviy/assets/header-jujutsu.jpg'};
export function validHeaderImage(path) {
  return typeof path==='string' && (path==='' || (/\.(svg|png|jpe?g|webp)$/i.test(path) && !/["\\\r\n]/.test(path) && !/^(javascript|data|file):/i.test(path)));
}
export function headerBackground(theme, backgrounds=DEFAULT_HEADER_BACKGROUNDS) {
  const path=backgrounds[theme] ?? DEFAULT_HEADER_BACKGROUNDS[theme] ?? '';
  return theme!=='standard' && validHeaderImage(path) ? path : '';
}
export function headerImageURL(path, baseURI) {
  if(!path || !validHeaderImage(path)) return '';
  return new URL(path,baseURI).href;
}
export function currencyTypes() { return game.settings.get("vitruviy", "currencyTypes") ?? [{id: "currency", name: "Валюта"}]; }
export function refreshPresentation() {
  const theme=game.settings.get("vitruviy", "theme") ?? "standard";
  document.body.dataset.vitTheme = theme;
  document.body.dataset.windFont=resolveFontPreset(theme,game.settings.get('vitruviy','fontPreset')??'theme');
  refreshTokenFonts().catch(console.error);
  const image=headerImageURL(headerBackground(theme,game.settings.get('vitruviy','headerBackgrounds') ?? DEFAULT_HEADER_BACKGROUNDS),document.baseURI);
  document.body.style.setProperty('--vit-header-image',image ? `url("${image}")` : 'none');
  for (const actor of game.actors) for (const app of Object.values(actor.apps)) app.render(false);
}
export function parseCurrencies(text, previous) {
  const names = String(text).split(/\r?\n/).map(name => name.trim()).filter(Boolean);
  if (names.length > 6 || names.some(name => name.length > 24) || new Set(names).size !== names.length) throw new Error("VIT.InvalidCurrencies");
  const used = new Set();
  const reserved = new Set(names.map(name => previous.find(entry => entry.name === name)?.id).filter(Boolean));
  return names.map((name, index) => {
    let id = previous.find(entry => entry.name === name)?.id;
    if (!id && !reserved.has(previous[index]?.id)) id = previous[index]?.id;
    if (!id || used.has(id)) id = foundry.utils.randomID();
    used.add(id); return {id, name};
  });
}

// Native private-roll placeholders have no WIND article, so core otherwise renders a light dice card.
// Never read message.content, rolls, result flags or speaker data for an unauthorized viewer.
export function styleHiddenRoll(message,html){
  if(!message.isRoll||message.isContentVisible!==false)return;
  const content=html.querySelector('.message-content');if(!content||content.querySelector('.vit-hidden-roll'))return;
  content.innerHTML=`<article class="vit-chat vit-hidden-roll"><header><i class="fa-solid fa-lock" aria-hidden="true"></i><span>${escape(t('HiddenRollTitle'))}</span></header><p>${escape(t('HiddenRollNotice'))}</p><div class="vit-hidden-result" aria-label="${escape(t('HiddenRollTitle'))}"><i class="fa-solid fa-dice-d6" aria-hidden="true"></i> ?</div></article>`;
}
