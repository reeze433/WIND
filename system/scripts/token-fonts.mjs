import {resolveFontPreset} from './fonts.mjs';

const FAMILIES={exo2:'Wind Exo 2',russoone:'Wind Russo One'};
let activeFamily=null;
let revision=0;
let installed=false;

// Keep Foundry's geometry, colours, outline and any inherited module styling.
export function installTokenFonts() {
  if(installed)return;
  const Base=CONFIG.Token.objectClass;
  CONFIG.Token.objectClass=class WindToken extends Base {
    _getTextStyle() {
      const style=super._getTextStyle();
      if(activeFamily){style.fontFamily=activeFamily;style.fontWeight='400';style.fontStyle='normal';}
      return style;
    }
  };
  installed=true;
  Hooks.on('canvasReady',()=>refreshTokenFonts().catch(console.error));
}

export async function refreshTokenFonts() {
  const request=++revision;
  const preset=resolveFontPreset(game.settings.get('vitruviy','theme'),game.settings.get('vitruviy','fontPreset')??'theme');
  const family=FAMILIES[preset]??null;
  // Do not measure canvas text in a fallback font while the TTF is loading.
  if(family){
    const faces=await document.fonts.load(`400 24px "${family}"`,'Иона Рифф Ёё');
    if(!faces.length)throw new Error(`Wind: font not loaded: ${family}`);
  }
  if(request!==revision)return;
  activeFamily=family;
  for(const token of globalThis.canvas?.tokens?.placeables??[]){
    token.renderFlags.set({refreshNameplate:true,refreshTooltip:true});
  }
}
