import test from 'node:test';
import assert from 'node:assert/strict';
import {chargePlan,validateChargeSource,withItemCharges,refundItemCharges} from '../system/scripts/charges.mjs';
globalThis.game={i18n:{localize:key=>key}};
globalThis.ui={notifications:{error:()=>{}}};
function setup(){
  const actor={uuid:'Actor.test',isOwner:true,items:new Map(),async updateEmbeddedDocuments(type,updates){
    assert.equal(type,'Item');for(const update of updates){const item=this.items.get(update._id);if('system.charges.value' in update)item.system.charges.value=update['system.charges.value'];if('system.quantity' in update)item.system.quantity=update['system.quantity'];
      for(const [key,value] of Object.entries(update))if(key.startsWith('flags.vitruviy.'))item.flags[key.slice(15)]=value;
    }
    return updates.map(update=>this.items.get(update._id));
  }};
  const make=(id,system)=>{const item={id,name:id,isOwner:true,actor,flags:{},getFlag(_scope,key){return this.flags[key];},system:{chargesEnabled:false,charges:{value:3,max:3},chargeCost:1,chargeSourceId:'',sourceChargeCost:1,...system}};actor.items.set(id,item);return item;};
  const parent=make('pool',{chargesEnabled:true});const child=make('ability',{chargeSourceId:'pool'});
  return {actor,parent,child};
}
test('one child use debits parent independently of quantity; own pool may also be spent',async()=>{
  const {parent,child}=setup();child.system.quantity=99;
  const receipt=await withItemCharges(child,async uses=>uses);
  assert.equal(parent.system.charges.value,2);assert.equal(child.system.quantity,99);
  assert.deepEqual(receipt,[{id:'pool',name:'pool',cost:1}]);
  child.system.chargesEnabled=true;child.system.chargeCost=2;
  await withItemCharges(child,async()=>{});
  assert.equal(child.system.charges.value,1);assert.equal(parent.system.charges.value,1);
});
test('insufficient, missing, disabled and foreign pools never debit anything',()=>{
  const {child,parent}=setup();parent.system.charges.value=0;
  assert.throws(()=>chargePlan(child),/NotEnoughCharges/);assert.equal(child.system.charges.value,3);
  parent.system.charges.value=3;parent.system.chargesEnabled=false;assert.throws(()=>chargePlan(child),/ChargeSourceNeedsPool/);
  parent.system.chargesEnabled=true;parent.actor={uuid:'Actor.other'};assert.throws(()=>validateChargeSource(child,parent),/ChargeSourceSameActor/);
  child.system.chargeSourceId='deleted';assert.throws(()=>chargePlan(child));
});
test('self links, cycles, no ownership and invalid costs are refused',()=>{
  const {child,parent}=setup();assert.throws(()=>validateChargeSource(parent,parent),/ChargeCycle/);
  parent.system.chargeSourceId=child.id;assert.throws(()=>chargePlan(child),/ChargeCycle/);parent.system.chargeSourceId='';
  child.system.sourceChargeCost=-1;assert.throws(()=>chargePlan(child),/InvalidCharges/);
  child.system.sourceChargeCost=1;child.isOwner=false;assert.throws(()=>chargePlan(child),/NoPermission/);
});
test('chat failure restores spent charges and releases lock',async()=>{
  const {parent,child}=setup();
  await assert.rejects(withItemCharges(child,async()=>{throw Error('chat failed');}),/chat failed/);
  assert.equal(parent.system.charges.value,3);
  await withItemCharges(child,async()=>{});assert.equal(parent.system.charges.value,2);
});
test('concurrent child uses cannot spend the same pool twice in this client',async()=>{
  const {parent,child}=setup();let release;
  const first=withItemCharges(child,()=>new Promise(resolve=>{release=resolve;}));
  await Promise.resolve();
  await assert.rejects(withItemCharges(child,async()=>{}),/ChargeUsePending/);
  release();await first;assert.equal(parent.system.charges.value,2);
});
test('unlimited items do not require charge metadata or update methods',async()=>{
  const item={system:{},actor:{uuid:'Actor.legacy'}};
  assert.deepEqual(chargePlan(item),[]);assert.equal(await withItemCharges(item,async()=>42),42);
});

test('chat refund restores both original pools once, even if child cost changes',async()=>{
 const {actor,parent,child}=setup();child.system.chargesEnabled=true;
 const receipt=await withItemCharges(child,async(uses,useId)=>({actorUuid:actor.uuid,uses,useId}));
 globalThis.fromUuid=async()=>actor;
 const message={visible:true,getFlag:(_s,key)=>key==='chargeUse'?receipt:null};
 child.system.sourceChargeCost=3;
 await refundItemCharges(message);assert.equal(parent.system.charges.value,3);assert.equal(child.system.charges.value,3);
 parent.system.charges.value=1;await refundItemCharges(message);assert.equal(parent.system.charges.value,1);
});
test('refund caps at maximum and refuses nonowners or missing pools',async()=>{
 const {actor,parent,child}=setup();
 const receipt=await withItemCharges(child,async(uses,useId)=>({actorUuid:actor.uuid,uses,useId}));
 globalThis.fromUuid=async()=>actor;const message={visible:true,getFlag:(_s,key)=>key==='chargeUse'?receipt:null};
 actor.isOwner=false;await assert.rejects(refundItemCharges(message));actor.isOwner=true;
 actor.items.delete(parent.id);await assert.rejects(refundItemCharges(message));actor.items.set(parent.id,parent);
 parent.system.charges.value=parent.system.charges.max;await refundItemCharges(message);assert.equal(parent.system.charges.value,3);
});
test('messages from previous charge version can refund once using their saved receipt',async()=>{
 const {actor,parent}=setup();parent.system.charges.value=1;
 globalThis.fromUuid=async()=>actor;
 const message={id:'oldMessage',visible:true,getFlag:(_s,key)=>key==='chargeUses'?[{id:parent.id,cost:2}]:key==='item'?{uuid:`${actor.uuid}.Item.child`}:null};
 await refundItemCharges(message);assert.equal(parent.system.charges.value,3);
 parent.system.charges.value=0;await refundItemCharges(message);assert.equal(parent.system.charges.value,0);
});

function receiverSetup(){
 const state=setup();
 const receiver={id:'pistol',name:'Малкин',isOwner:true,actor:state.actor,flags:{},getFlag(_s,key){return this.flags[key];},system:{chargesEnabled:true,charges:{value:2,max:8}}};
 state.actor.items.set(receiver.id,receiver);state.child.system.chargeReceiverId=receiver.id;state.child.system.restoreChargeAmount=6;
 return {...state,receiver};
}
test('using a reload consumes source and restores receiver up to maximum; undo reverses both once',async()=>{
 const {actor,parent,child,receiver}=receiverSetup();
 const receipt=await withItemCharges(child,async(uses,useId)=>({actorUuid:actor.uuid,uses,useId}));
 assert.equal(parent.system.charges.value,2);assert.equal(receiver.system.charges.value,8);
 assert.equal(receipt.uses.find(use=>use.id===receiver.id).cost,-6);
 globalThis.fromUuid=async()=>actor;const message={visible:true,getFlag:(_s,key)=>key==='chargeUse'?receipt:null};
 await refundItemCharges(message);assert.equal(parent.system.charges.value,3);assert.equal(receiver.system.charges.value,2);
 await refundItemCharges(message);assert.equal(receiver.system.charges.value,2);
});
test('full receiver and missing receiver do not consume ammunition',async()=>{
 const {parent,child,receiver}=receiverSetup();receiver.system.charges.value=8;
 await assert.rejects(withItemCharges(child,async()=>{}),/ChargeReceiverFull/);assert.equal(parent.system.charges.value,3);
 child.system.chargeReceiverId='deleted';assert.throws(()=>chargePlan(child),/ChargeReceiverMissing/);
});
test('only actual restored amount is recorded; full mode ignores fixed amount',async()=>{
 const {child,receiver}=receiverSetup();receiver.system.charges.value=7;
 const uses=await withItemCharges(child,async uses=>uses);assert.equal(uses.find(use=>use.id===receiver.id).cost,-1);
 receiver.system.charges.value=0;child.system.chargeRestoreFull=true;child.system.restoreChargeAmount=1;
 await withItemCharges(child,async()=>{});assert.equal(receiver.system.charges.value,8);
});
test('failed message reverses refill, while spent refill prevents unsafe refund of ammo',async()=>{
 const {actor,parent,child,receiver}=receiverSetup();
 await assert.rejects(withItemCharges(child,async()=>{throw Error('offline');}));
 assert.equal(parent.system.charges.value,3);assert.equal(receiver.system.charges.value,2);
 const receipt=await withItemCharges(child,async(uses,useId)=>({actorUuid:actor.uuid,uses,useId}));
 receiver.system.charges.value=1;globalThis.fromUuid=async()=>actor;
 await assert.rejects(refundItemCharges({visible:true,getFlag:(_s,key)=>key==='chargeUse'?receipt:null}),/ChargeRestorationSpent/);
 assert.equal(parent.system.charges.value,2);assert.equal(receiver.system.charges.value,1);
});
test('receiver-only actions work and same pool changes merge instead of producing duplicate updates',async()=>{
 const {child,parent,receiver}=receiverSetup();child.system.chargeSourceId='';child.system.quantityUsage='none';
 await withItemCharges(child,async()=>{});assert.equal(receiver.system.charges.value,8);assert.equal(parent.system.charges.value,3);
 parent.system.chargeReceiverId=parent.id;parent.system.restoreChargeAmount=2;parent.system.charges.value=1;
 const plan=chargePlan(parent);assert.equal(plan.length,1);assert.equal(plan[0].cost,-1);
 await withItemCharges(parent,async()=>{});assert.equal(parent.system.charges.value,2);
});

test('consumable stacks debit without any charge pool; failed creation and refund restore once',async()=>{
 const {actor,child}=setup();child.system.chargeSourceId='';child.system.quantityUsage='consume';child.system.quantity=3;child.system.quantityCost=2;
 await assert.rejects(withItemCharges(child,async()=>{throw Error('offline');}));assert.equal(child.system.quantity,3);
 const receipt=await withItemCharges(child,async(uses,useId,quantity)=>({actorUuid:actor.uuid,uses,useId,quantity}));
 assert.equal(child.system.quantity,1);globalThis.fromUuid=async()=>actor;
 const message={visible:true,getFlag:(_s,key)=>key==='chargeUse'?receipt:null};
 await refundItemCharges(message);assert.equal(child.system.quantity,3);await refundItemCharges(message);assert.equal(child.system.quantity,3);
});
test('magazine auto mode consumes a stack and reloads, with atomic inverse and empty stack protection',async()=>{
 const {actor,child,receiver}=receiverSetup();child.system.chargeSourceId='';child.system.quantity=2;
 const receipt=await withItemCharges(child,async(uses,useId,quantity)=>({actorUuid:actor.uuid,uses,useId,quantity}));
 assert.equal(child.system.quantity,1);assert.equal(receiver.system.charges.value,8);
 globalThis.fromUuid=async()=>actor;await refundItemCharges({visible:true,getFlag:(_s,key)=>key==='chargeUse'?receipt:null});
 assert.equal(child.system.quantity,2);assert.equal(receiver.system.charges.value,2);
 child.system.quantity=0;await assert.rejects(withItemCharges(child,async()=>{}),/NotEnoughQuantity/);assert.equal(receiver.system.charges.value,2);
});
