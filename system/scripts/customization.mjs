import {setChangedSetting} from './settings-utils.mjs';
import {t} from "./rolls.mjs";
import {validCoinIcon} from "./coin.mjs";
import {currencyTypes, parseCurrencies,DEFAULT_HEADER_BACKGROUNDS,validHeaderImage} from "./presentation.mjs";
import {refreshCoinDice} from './dice3d.mjs';
import {DEFAULT_COIN_ATLAS,saveCoinAtlas,readCoinAtlas,coinAtlasHTML} from './coin-atlas.mjs';
export class CustomizationSettings extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = {id: "vitruviy-customization", classes:["vitruviy"], tag: "form", position: {width: 560,height:600}, window: {title: "VIT.Customization",resizable:true},
    form: {closeOnSubmit: true, handler: this.save}};
  static PARTS = {body: {template: "systems/vitruviy/templates/customization.hbs",scrollable:['.vit-customization-scroll']}};
  _onRender(context,options) {
    super._onRender(context,options);
    const picker=this.element.querySelector('file-picker[name="coinAtlas"]');
    const refresh=async()=>{const path=picker.value;try {const atlas=await readCoinAtlas(path);if(picker.value!==path||!this.element)return;this.element.querySelector('.vit-atlas-preview').innerHTML=coinAtlasHTML(atlas,false,t('CoinFailure'))+coinAtlasHTML(atlas,true,t('CoinSuccess'));}catch {if(this.element&&picker.value===path)this.element.querySelector('.vit-atlas-preview').textContent=t('InvalidCoinAtlas');}};
    picker.addEventListener('change',refresh);
  }
  async _prepareContext() {
    const path=game.settings.get('vitruviy','coinAtlas')||DEFAULT_COIN_ATLAS;
    let preview='';try{const atlas=await readCoinAtlas(game.settings.get('vitruviy','coinAtlasTexture')||DEFAULT_COIN_ATLAS);preview=coinAtlasHTML(atlas,false,t('CoinFailure'))+coinAtlasHTML(atlas,true,t('CoinSuccess'));}catch {preview=t('InvalidCoinAtlas');}
    const headers=game.settings.get('vitruviy','headerBackgrounds') ?? DEFAULT_HEADER_BACKGROUNDS;
    return {headerStarWars:headers.starwars ?? '',headerCodeRed:headers.cyberpunk ?? '',headerJujutsu:headers.jujutsu ?? DEFAULT_HEADER_BACKGROUNDS.jujutsu,coinAtlas:path,preview,diceStyle:game.settings.get("vitruviy","diceStyle"), faces:[1,2,3,4,5,6].map((n,i)=>({n,path:game.settings.get("vitruviy","diceFaces")[i]??""})), currencies: currencyTypes().map(entry => entry.name).join("\n")};
  }
  static async save(_event, _form, data) {
    if (!game.user.isGM) throw new Error(t("NoPermission"));
    const {coinAtlas, currencies,diceStyle} = data.object;
    const headers={starwars:String(data.object.headerStarWars ?? '').trim(),cyberpunk:String(data.object.headerCodeRed ?? '').trim(),jujutsu:String(data.object.headerJujutsu ?? DEFAULT_HEADER_BACKGROUNDS.jujutsu).trim()};
    if(!Object.values(headers).every(validHeaderImage)) throw new Error(t('InvalidHeaderImage'));
    const faces=[1,2,3,4,5,6].map(n=>String(data.object[`face${n}`]??"").trim());
    if(!["red","numeric"].includes(diceStyle)||faces.some(p=>p && (!validCoinIcon(p)||!/\.(png|jpe?g|webp)$/i.test(p))))throw new Error(t("InvalidDiceFaces"));
    let entries;
    try { entries = parseCurrencies(currencies, currencyTypes()); } catch { throw new Error(t("InvalidCurrencies")); }
    let prepared;try {prepared=coinAtlas===game.settings.get('vitruviy','coinAtlas')&&game.settings.get('vitruviy','coinAtlasTexture')?{source:coinAtlas,texture:game.settings.get('vitruviy','coinAtlasTexture')}:await saveCoinAtlas(coinAtlas);}catch(error){ui.notifications.error(t('InvalidCoinAtlas'));throw error;}
    await setChangedSetting("headerBackgrounds",headers);
    await setChangedSetting("diceStyle",diceStyle);
    await setChangedSetting("diceFaces",faces);
    const coinChanged=await setChangedSetting('coinAtlasTexture',prepared.texture);
    await setChangedSetting('coinAtlas',prepared.source);
    await setChangedSetting("currencyTypes", entries);
    try {if(coinChanged)await refreshCoinDice();} catch(error) {ui.notifications.warn(t('CoinTextureError'));console.error('Wind | coin texture',error);}
  }
}
