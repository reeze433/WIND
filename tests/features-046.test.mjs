import test from 'node:test';import assert from 'node:assert/strict';
import {chargeMaximum,prepareChargeData,chargeFormulaError} from '../system/scripts/charge-formula.mjs';
import {preparedCount} from '../system/scripts/cards.mjs';
import {customResourceState} from '../system/scripts/resource-state.mjs';
import {chargePlan} from '../system/scripts/charges.mjs';

test('formula maximum follows the owner, accepts Russian multiplication notation and safely rounds',()=>{
 const actor={system:{attributes:{thinking:4,combat:2}}};const system={chargesEnabled:true,chargesMaxFormula:'Мышление x 3',charges:{value:9,max:1}};
 assert.equal(chargeMaximum(system,actor),12);prepareChargeData(system,actor,{value:9});assert.deepEqual(system.charges,{value:9,max:12});
 actor.system.attributes.thinking=5;prepareChargeData(system,actor,{value:9});assert.deepEqual(system.charges,{value:9,max:15});
 system.chargesMaxFormula='(Мышление + Сражение) / 2';assert.equal(chargeMaximum(system,actor),3);
 system.chargesMaxFormula='-3';assert.equal(chargeMaximum(system,actor),0);
 system.chargesMaxFormula='';assert.equal(chargeMaximum(system,actor),15);
});
test('derived cap does not overwrite stored charges and a world template waits for its owner',()=>{
 const actor={system:{attributes:{thinking:2}}};const stored={value:9,max:1};const system={chargesEnabled:true,chargesMaxFormula:'thinking * 3',charges:{...stored}};
 prepareChargeData(system,actor,stored);assert.equal(system.charges.value,6);assert.equal(stored.value,9);
 actor.system.attributes.thinking=4;prepareChargeData(system,actor,stored);assert.equal(system.charges.value,9);
 assert.equal(chargeMaximum({...system,charges:{max:1}},null),1);
});
test('item-bound memory and charge spending use the same calculated maximum; invalid formula blocks use',()=>{
 globalThis.game={settings:{get:(_scope,key)=>key==='customResourceCount'?1:['Память']},i18n:{localize:key=>key}};
 const actor={uuid:'Actor.bart',isOwner:true,system:{attributes:{thinking:4},customResources:{r0:{maximumMode:'item',maximumItemId:'deck'}}},items:new Map()};
 const deck={id:'deck',name:'Апогей',actor,isOwner:true,system:{chargesEnabled:true,chargesMaxFormula:'thinking * 3',charges:{value:10,max:1},quantityUsage:'none',chargeCost:1}};actor.items.set('deck',deck);
 prepareChargeData(deck.system,actor);assert.equal(customResourceState(actor,{id:'r0'}).maximum,12);assert.equal(chargePlan(deck)[0].cost,1);
 deck.system.chargesMaxFormula='globalThis.process.exit()';assert.equal(chargeFormulaError(deck),true);assert.throws(()=>chargePlan(deck),/InvalidChargeFormula/);
 assert.ok(customResourceState(actor,{id:'r0'}).error);
});
test('prepared counts are separated by category and count cards rather than quantities or active effect toggles',()=>{
 const cards=[{system:{category:'equipment',prepared:true,quantity:200}},{system:{category:'ability',prepared:true}},{system:{category:'ability',prepared:false}},{system:{category:'equipment',effectEnabled:true}},{system:{category:'other',prepared:true}}];
 assert.equal(preparedCount(cards,'equipment'),1);assert.equal(preparedCount(cards,'ability'),1);
 cards[2].system.prepared=true;assert.equal(preparedCount(cards,'ability'),2);
 cards[0].system.prepared=false;assert.equal(preparedCount(cards,'equipment'),0);
});
