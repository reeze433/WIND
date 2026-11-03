import test from 'node:test';import assert from 'node:assert/strict';
globalThis.Hooks={once:()=>{}};
const {itemPilesConfiguration,syncItemPilesCurrencies}=await import('../system/scripts/item-piles.mjs');
let types=[{id:'cash',name:'Кредиты'},{id:'gold',name:'Золото'}];
const stored=new Map([['currencies',[]],['secondaryCurrencies',[]],['currencyDecimalDigits',2]]);
globalThis.game={user:{id:'gm'},users:{activeGM:{id:'gm'}},modules:new Map([['item-piles',{active:true}]]),settings:{
  get:(scope,key)=>scope==='vitruviy'?types:stored.get(key),set:async(_scope,key,value)=>stored.set(key,value)
}};
test('installed Item Piles wallet settings follow all WIND currencies, including changes',async()=>{
  await syncItemPilesCurrencies();
  assert.equal(stored.get('currencies')[0].data.path,'system.currencies.cash');
  assert.equal(stored.get('secondaryCurrencies')[0].data.path,'system.currencies.gold');
  assert.equal(stored.get('currencyDecimalDigits'),1);
  stored.get('currencies')[0].img='custom.webp';types=[{id:'cash',name:'Евробаксы'},{id:'tokens',name:'Жетоны'}];
  await syncItemPilesCurrencies();
  assert.equal(stored.get('currencies')[0].name,'Евробаксы');assert.equal(stored.get('currencies')[0].img,'custom.webp');
  assert.equal(stored.get('secondaryCurrencies')[0].data.path,'system.currencies.tokens');
});
test('players do not rewrite Item Piles configuration; charge pools with different balance never stack',async()=>{
  game.user={id:'player'};types=[{id:'other',name:'Other'}];await syncItemPilesCurrencies();
  assert.equal(stored.get('currencies')[0].data.path,'system.currencies.cash');
  const config=itemPilesConfiguration();
  assert.ok(config.ITEM_SIMILARITIES.includes('system.charges.value'));assert.ok(config.ITEM_SIMILARITIES.includes('system.chargeSourceId'));
});
