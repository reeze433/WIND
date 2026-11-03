import test from 'node:test';import assert from 'node:assert/strict';
import {customResourceState} from '../system/scripts/resource-state.mjs';
import {customSpendPlan} from '../system/scripts/resource-spending.mjs';
import {withItemCharges,refundItemCharges} from '../system/scripts/charges.mjs';
let count,actor,item;
function setup(){
 count=2;
 globalThis.game={i18n:{localize:key=>key},settings:{get:(_s,key)=>key==='customResourceCount'?count:['Мана','Фокус']}};
 globalThis.ui={notifications:{error:()=>{}}};
 actor={uuid:'Actor.hero',isOwner:true,flags:{},system:{attributes:{thinking:3},customResources:{r0:{value:6,maximum:'6'},r1:{value:4,maximum:'4'}}},items:new Map(),
  getFlag(_s,key){return this.flags[key];},async update(updates){for(const [key,value] of Object.entries(updates)){
    if(key.startsWith('flags.vitruviy.'))this.flags[key.slice(15)]=value;
    const match=key.match(/^system.customResources\.(r\d+)\.value$/);if(match)this.system.customResources[match[1]].value=value;
  }return this;},async updateEmbeddedDocuments(_type,updates){for(const update of updates){const entry=this.items.get(update._id);
    if('system.charges.value' in update)entry.system.charges.value=update['system.charges.value'];
    if('system.quantity' in update)entry.system.quantity=update['system.quantity'];
    for(const [key,value] of Object.entries(update))if(key.startsWith('flags.vitruviy.'))entry.flags[key.slice(15)]=value;
  }return updates.map(update=>this.items.get(update._id));}
 };
 item={id:'ability',name:'Power',actor,isOwner:true,flags:{},getFlag(_s,key){return this.flags[key];},system:{customResourceId:'r0',customResourceCost:2,chargesEnabled:true,charges:{value:2,max:2},chargeCost:1,quantityUsage:'consume',quantityCost:1,quantity:3}};
 actor.items.set(item.id,item);globalThis.fromUuid=async()=>actor;
}
test('item maximum uses capacity rather than remaining charges and ignores inactive formula',()=>{
 setup();actor.system.customResources.r0={value:4,maximumMode:'item',maximumItemId:item.id,maximum:'invalid'};
 assert.equal(customResourceState(actor,{id:'r0'}).maximum,2);
 item.system.charges.value=0;item.system.charges.max=12;assert.equal(customResourceState(actor,{id:'r0'}).maximum,12);
 actor.system.customResources.r0.maximumMode='formula';actor.system.customResources.r0.maximum='8';assert.equal(customResourceState(actor,{id:'r0'}).maximum,8);
});
test('missing or disabled capacity item gives an error, not fallback to formula',()=>{
 setup();actor.system.customResources.r0={maximumMode:'item',maximumItemId:'deleted',maximum:'8'};
 assert.ok(customResourceState(actor,{id:'r0'}).error);
 actor.system.customResources.r0.maximumItemId=item.id;item.system.chargesEnabled=false;assert.ok(customResourceState(actor,{id:'r0'}).error);
});
test('one use spends selected counter plus charges and quantity; refund restores each only once',async()=>{
 setup();const receipt=await withItemCharges(item,async(uses,useId,quantity,customResource)=>({actorUuid:actor.uuid,uses,useId,quantity,customResource}));
 assert.equal(actor.system.customResources.r0.value,4);assert.equal(actor.system.customResources.r1.value,4);
 assert.equal(item.system.charges.value,1);assert.equal(item.system.quantity,2);
 const message={visible:true,getFlag:(_s,key)=>key==='chargeUse'?receipt:null};
 await refundItemCharges(message);assert.equal(actor.system.customResources.r0.value,6);assert.equal(item.system.charges.value,2);assert.equal(item.system.quantity,3);
 await refundItemCharges(message);assert.equal(actor.system.customResources.r0.value,6);
});
test('publication failure restores the counter and other costs; hidden and insufficient counters block use',async()=>{
 setup();await assert.rejects(withItemCharges(item,async()=>{throw Error('offline');}));
 assert.equal(actor.system.customResources.r0.value,6);assert.equal(item.system.charges.value,2);assert.equal(item.system.quantity,3);
 actor.system.customResources.r0.value=1;await assert.rejects(withItemCharges(item,async()=>{}),/NotEnoughCustomResource/);
 assert.equal(item.system.quantity,3);count=0;assert.throws(()=>customSpendPlan(item),/CustomResourceUnavailable/);
 item.system.customResourceId='';assert.equal(customSpendPlan(item),null);
});
test('counter-only ability needs no charge or quantity pool',async()=>{
 setup();item.system.chargesEnabled=false;item.system.quantityUsage='none';
 await withItemCharges(item,async()=>{});assert.equal(actor.system.customResources.r0.value,4);assert.equal(item.system.quantity,3);
});
