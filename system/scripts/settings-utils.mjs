let sheetRefreshTimer;
export function scheduleSheetRefresh(){clearTimeout(sheetRefreshTimer);sheetRefreshTimer=setTimeout(()=>{for(const actor of game.actors??[])for(const app of Object.values(actor.apps??{}))app.render(false);},50);}
export async function setChangedSetting(key,value){if(JSON.stringify(game.settings.get('vitruviy',key))!==JSON.stringify(value)){await game.settings.set('vitruviy',key,value);return true;}return false;}
