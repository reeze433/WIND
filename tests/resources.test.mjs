import test from 'node:test';
import assert from 'node:assert/strict';
import {toggleItemInspiration,spendInspiration} from '../system/scripts/resources.mjs';
import {canIncreaseInspiration} from '../system/scripts/rolls.mjs';
let state=false,updates=0;
const actor={uuid:'Actor.a',isOwner:true,system:{inspiration:{value:4}},getFlag:()=>state,async update(data,options={}){if(data['system.inspiration.value']>this.system.inspiration.value)assert.equal(canIncreaseInspiration(this,data['system.inspiration.value'],options),true);state=data['flags.vitruviy.resourceUses.m']??state;this.system.inspiration.value=data['system.inspiration.value'];updates++;return this;}};
const message={id:'m',visible:true,getFlag:()=>({actorUuid:actor.uuid,cost:3})};
globalThis.game={user:{isGM:false},i18n:{localize:x=>x}};
globalThis.fromUuid=async()=>actor;
test('spend/refund toggle applies cost once per state, repeated returns cannot inflate balance',async()=>{
 await toggleItemInspiration(message);assert.equal(actor.system.inspiration.value,1);assert.equal(state,true);
 await toggleItemInspiration(message);assert.equal(actor.system.inspiration.value,4);assert.equal(state,false);
 await toggleItemInspiration(message);await toggleItemInspiration(message);assert.equal(actor.system.inspiration.value,4);
 assert.equal(canIncreaseInspiration(actor,99,{vitruviyInspirationRefund:true}),false);
});
test('insufficient funds, hidden message and nonowner do not update resources',async()=>{
 actor.system.inspiration.value=1;const before=updates;await assert.rejects(toggleItemInspiration(message));assert.equal(updates,before);
 await assert.rejects(toggleItemInspiration({...message,visible:false}));actor.isOwner=false;await assert.rejects(spendInspiration(actor));await assert.rejects(toggleItemInspiration(message));actor.isOwner=true;
});
test('receipt shares the item ledger and can refund only once, never respends',async()=>{
 actor.system.inspiration.value=1;state=true;
 const receipt={id:'receipt',visible:true,getFlag:()=>({actorUuid:actor.uuid,cost:3,useId:'m',refundOnly:true})};
 await toggleItemInspiration(receipt);assert.equal(actor.system.inspiration.value,4);assert.equal(state,false);
 const before=updates;await toggleItemInspiration(receipt);assert.equal(updates,before);assert.equal(actor.system.inspiration.value,4);
 await toggleItemInspiration(message);assert.equal(actor.system.inspiration.value,1);await toggleItemInspiration(receipt);assert.equal(actor.system.inspiration.value,4);
});

globalThis.ui={notifications:{warn:()=>{}}};
