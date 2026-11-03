export const GRID_LIMIT_CHOICES=[32,64,128,256,512];
export const CARD_WIDTH_CHOICES=[3,4,5];
export function normalizeCardDefaults(value={}){
 return {gridWidth:CARD_WIDTH_CHOICES.includes(value?.gridWidth)?value.gridWidth:3,grids:Object.fromEntries(['ability','equipment','custom'].map(type=>[type,GRID_LIMIT_CHOICES.includes(value?.grids?.[type])?value.grids[type]:64]))};
}
export function cardDefaults(){try{return normalizeCardDefaults(globalThis.game?.settings?.get('vitruviy','cardCreationDefaults'));}catch{return normalizeCardDefaults();}}
export const panelGridLimit=type=>cardDefaults().grids[type]??64;

export function panelOrder(value=[]){return [...new Set([...(Array.isArray(value)?value:[]).filter(type=>['ability','equipment','custom'].includes(type)),'ability','equipment','custom'])];}

export function usesCardGrid(){return false;}
