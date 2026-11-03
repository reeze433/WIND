export const FONT_PRESETS = ['theme','standard','exo2','russoone'];
export function resolveFontPreset(theme, choice='theme') {
  if(choice!=='theme' && FONT_PRESETS.includes(choice))return choice;
  return ({starwars:'exo2',cyberpunk:'russoone'})[theme]??'standard';
}
