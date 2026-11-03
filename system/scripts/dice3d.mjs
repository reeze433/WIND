import {registerPlayerDice,playerDiceSystem} from './player-dice.mjs';
import {DEFAULT_COIN_ATLAS} from './coin-atlas.mjs';
export async function registerDice(dice3d) {
  const style=game.settings.get('vitruviy','diceStyle')??'red';
  const custom=game.settings.get('vitruviy','diceFaces')??[];
  dice3d.addSystem({id:'vitruviy-successes',name:'Wind — успехи'},'default');
  dice3d.addDicePreset({type:'d6',system:'vitruviy-successes',labels:[1,2,3,4,5,6].map((n,i)=>custom[i]||`face-${n}.png`),atlas:`systems/vitruviy/assets/d6-${style}.json`});
  await refreshCoinDice(dice3d);
  await registerPlayerDice(dice3d);

}
export function prepareDiceRoll(roll) {
  if(!game.modules?.get('dice-so-nice')?.active)return;
  for(const die of roll.dice)die.options.appearance={...(die.options.appearance??{}),system:playerDiceSystem()};
}


let coinSystem='vitruviy-successes';
const coinRegistrations=new Map();
export async function refreshCoinDice(dice3d=game.dice3d) {
  if(!dice3d)return coinSystem;
  const atlas=game.settings.get('vitruviy','coinAtlasTexture')||DEFAULT_COIN_ATLAS;
  const key=atlas;
  if(!coinRegistrations.has(key))coinRegistrations.set(key,(async()=>{
    const defaults=atlas===DEFAULT_COIN_ATLAS;
    let hash=2166136261;for(const char of key)hash=Math.imul(hash^char.charCodeAt(0),16777619);
    const system=defaults?'vitruviy-successes':`vitruviy-coin-${(hash>>>0).toString(16)}`;
    const labels=['failure.png','success.png'];
    if(!defaults)dice3d.addSystem({id:system,name:'Wind — монетка'},'default');
    dice3d.addDicePreset({type:'d2',system,labels,atlas});
    return system;
  })().catch(error=>{coinRegistrations.delete(key);throw error;}));
  coinSystem=await coinRegistrations.get(key);return coinSystem;
}
export async function prepareCoinRoll(roll) {
  if(!game.modules?.get('dice-so-nice')?.active)return;
  const system=await refreshCoinDice();
  for(const die of roll.dice)die.options.appearance={...(die.options.appearance??{}),system};
}
