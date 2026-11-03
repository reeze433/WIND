import {t} from './rolls.mjs';
import {validCoinIcon} from './coin.mjs';
const systems=new Map(),registered=new Set();
export function diceProfileId(userId,profile){
  let hash=2166136261;for(const char of JSON.stringify(profile))hash=Math.imul(hash^char.charCodeAt(0),16777619);
  return `wind-player-${userId}-${(hash>>>0).toString(16)}`;
}
export function validateDiceProfile(profile){
  if(!['red','numeric','custom'].includes(profile.style))throw Error(t('InvalidDiceFaces'));
  if(profile.style==='custom'&&(!Array.isArray(profile.faces)||profile.faces.length!==6||profile.faces.some(path=>!path||!validCoinIcon(path)||!/\.(png|jpe?g|webp)$/i.test(path))))throw Error(t('InvalidDiceFaces'));
  return profile;
}
export async function registerPlayerDice(dice3d=game.dice3d){
  if(!dice3d)return;
  systems.clear();
  for(const [userId,profile] of Object.entries(game.settings.get('vitruviy','playerDice')??{})){
    validateDiceProfile(profile);const id=diceProfileId(userId,profile);systems.set(userId,id);
    if(registered.has(id))continue;
    dice3d.addSystem({id,name:`Wind · ${game.users.get(userId)?.name??userId}`},'default');
    dice3d.addDicePreset({type:'d6',system:id,labels:profile.style==='custom'?profile.faces:[1,2,3,4,5,6].map(number=>`face-${number}.png`),
      ...(profile.style==='custom'?{}:{atlas:`systems/vitruviy/assets/d6-${profile.style}.json`})});
    registered.add(id);
  }
}
export function playerDiceSystem(userId=game.user?.id){return systems.get(userId)??'vitruviy-successes';}
