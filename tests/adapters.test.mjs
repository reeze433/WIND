import test from 'node:test';import assert from 'node:assert/strict';
const hooks={};globalThis.Hooks={once:(name,fn)=>hooks[name]=fn,callAll:()=>{}};
globalThis.game={settings:{get:(_s,k)=>k==='currencyTypes'?[{id:'cash',name:'Cash'},{id:'gold',name:'Gold'}]:k==='diceStyle'?'red':k==='diceFaces'?[]:undefined},modules:new Map()};
const {itemPilesConfiguration}=await import('../system/scripts/item-piles.mjs');
const {registerDice,prepareDiceRoll}=await import('../system/scripts/dice3d.mjs');
test('Item Piles fields match system schema; currencies independent; preview strips private information only',()=>{
 const c=itemPilesConfiguration();assert.equal(c.ITEM_QUANTITY_ATTRIBUTE,'system.quantity');assert.equal(c.ITEM_PRICE_ATTRIBUTE,'system.price');assert.equal(c.CURRENCIES[0].data.path,'system.currencies.cash');assert.equal(c.SECONDARY_CURRENCIES[0].data.path,'system.currencies.gold');
 const item={system:{privateDescription:'secret',rollEnabled:true,cost:2}};assert.equal(c.ITEM_TRANSFORMER(item).system.rollEnabled,true);assert.equal(c.PREVIEW_ITEM_TRANSFORMER(item).system.privateDescription,'');assert.equal(item.system.privateDescription,'secret');
});
test('Dice So Nice registers all six faces and two coin faces without changing roll results',async()=>{
 const presets=[];await registerDice({addSystem:()=>{},addDicePreset:p=>presets.push(p)});assert.deepEqual(presets[0].labels,['face-1.png','face-2.png','face-3.png','face-4.png','face-5.png','face-6.png']);assert.deepEqual(presets[1].labels,['failure.png','success.png']);
 game.modules.set('dice-so-nice',{active:true});const roll={dice:[{options:{},results:[{result:6}]}]};prepareDiceRoll(roll);assert.equal(roll.dice[0].results[0].result,6);assert.equal(roll.dice[0].options.appearance.system,'vitruviy-successes');
});
