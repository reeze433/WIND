import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeCard,categoryOf,orderCards} from '../system/scripts/cards.mjs';
test('legacy items become universal cards without losing category, identity, ownership or resource fields',()=>{
  for(const type of ['trait','ability','condition','equipment','other']){
    const source={_id:'kept',type,ownership:{A:3},system:{quantity:4,cost:2,privateDescription:'secret',tier:'B'}};
    const migrated=normalizeCard(source);assert.equal(migrated.type,'card');assert.equal(categoryOf(migrated),type==='trait'?'ability':type);
    assert.equal(migrated._id,'kept');assert.equal(migrated.ownership.A,3);assert.equal(migrated.system.cost,2);assert.equal(migrated.system.privateDescription,'secret');
    assert.deepEqual(normalizeCard(migrated),migrated);
  }
  assert.equal(categoryOf({type:'card',system:{category:'other'}}),'other');
  const existing={_id:'universal',type:'card',system:{category:'trait',quantity:3,description:'retained'}};
  normalizeCard(existing);assert.equal(existing.system.category,'ability');assert.equal(existing.system.description,'retained');assert.equal(existing.system.quantity,3);
});
test('manual order and both Russian name and quantity directions preserve original collection',()=>{
  const items=[{id:'a',name:'Яблоко',sort:300,system:{quantity:2}},{id:'b',name:'Арбалет',sort:100,system:{quantity:8}},{id:'c',name:'Бинт',sort:200,system:{quantity:1}}];
  const ids=mode=>orderCards(items,mode).map(i=>i.id);
  assert.deepEqual(ids('manual'),['b','c','a']);assert.deepEqual(ids('nameAsc'),['b','c','a']);assert.deepEqual(ids('nameDesc'),['a','c','b']);assert.deepEqual(ids('quantityDesc'),['b','a','c']);assert.deepEqual(ids('quantityAsc'),['c','a','b']);assert.equal(items[0].id,'a');
});
