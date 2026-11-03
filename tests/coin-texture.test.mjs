import test from 'node:test';import assert from 'node:assert/strict';
import {refreshCoinDice,prepareCoinRoll} from '../system/scripts/dice3d.mjs';
let path='art/coin-1.json',presets=[];
globalThis.game={settings:{get:()=>path},modules:new Map([['dice-so-nice',{active:true}]])};
game.dice3d={addSystem:()=>{},addDicePreset:p=>presets.push(p)};
test('coin uses a real atlas like d6; changing atlas gets fresh 3D materials without canvas data URLs',async()=>{
 const first=await refreshCoinDice();assert.equal(presets[0].atlas,path);assert.deepEqual(presets[0].labels,['failure.png','success.png']);
 path='art/coin-2.json';const second=await refreshCoinDice();assert.notEqual(first,second);assert.equal(presets.length,2);
 const roll={dice:[{options:{},results:[{result:2}]}]};await prepareCoinRoll(roll);assert.equal(roll.dice[0].options.appearance.system,second);assert.equal(presets.length,2);assert.equal(roll.dice[0].results[0].result,2);
});
