import {inspirationTemplates} from './inspiration-chat.mjs';
import {GRID_LIMIT_CHOICES,CARD_WIDTH_CHOICES} from './card-defaults.mjs';
import {ATTRIBUTES} from './dice.mjs';
export function hubSettingPlan(data){
 data={gridWidth:3,ability:64,equipment:64,custom:64,cardLayout:'list',cardGridOpacity:0,...data};
 const integer=(key,min,max=Number.MAX_SAFE_INTEGER)=>{const value=Number(data[key]);if(!Number.isSafeInteger(value)||value<min||value>max)throw Error('VIT.InvalidCheck');return value;};
 const choice=(key,values)=>{if(!values.includes(data[key]))throw Error('VIT.InvalidCheck');return data[key];};
 const gridWidth=integer('gridWidth',3,5);if(!CARD_WIDTH_CHOICES.includes(gridWidth))throw Error('VIT.InvalidCheck');
 const grids=Object.fromEntries(['ability','equipment','custom'].map(type=>{const value=integer(type,32,512);if(!GRID_LIMIT_CHOICES.includes(value))throw Error('VIT.InvalidCheck');return [type,value];}));
 const name=String(data.customPanelName??'').trim()||'Кастом';if(name.length>80)throw Error('VIT.InvalidCheck');
 return {responseRollVisibility:data.responseRollVisibility===undefined?'public':choice('responseRollVisibility',['public','gm']),inspirationMessages:inspirationTemplates(data.inspirationMessages??Object.fromEntries(["gain","spend","edit"].map(key=>[key,data[`inspirationMessages.${key}`]]))),cardLayout:choice('cardLayout',['grid','list']),healthPerWellbeing:integer('healthPerWellbeing',0),criticalOnDoubleSuccess:data.criticalOnDoubleSuccess===true,initiativeAttribute:choice('initiativeAttribute',ATTRIBUTES),movementUnits:choice('movementUnits',['feet','metres','zones']),customPanelName:name,cardGridOpacity:integer('cardGridOpacity',0,100),cardCreationDefaults:{gridWidth,grids},theme:choice('theme',['standard','starwars','cyberpunk','jujutsu']),fontPreset:choice('fontPreset',['theme','standard','exo2','russoone'])};
}
