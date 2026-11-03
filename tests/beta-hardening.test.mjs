import test from 'node:test';
import assert from 'node:assert/strict';
import {checkedUpdate,checkedEmbeddedUpdate} from '../system/scripts/document-writes.mjs';
import {rollItem} from '../system/scripts/items.mjs';
import {withItemCharges,chargePlan} from '../system/scripts/charges.mjs';
import {itemAvailability} from '../system/scripts/item-availability.mjs';
import {serializeOperation,processResourceRequest,registerResourceAction} from '../system/scripts/operations.mjs';
import {processCurrencyTransfer,recoverCurrencyTransfers} from '../system/scripts/currency.mjs';
import '../system/scripts/resources.mjs';
const gm={id:'gm',isGM:true},player={id:'p'},other={id:'other'};
let messages,actor,item;
function setup(){
 globalThis.foundry={applications:{ux:{TextEditor:{enrichHTML:async text=>text}}}};
 const users=[gm,player,other];users.activeGM=gm;users.get=id=>users.find(user=>user.id===id);
 globalThis.game={user:gm,users,i18n:{localize:key=>key},settings:{get:(_scope,key)=>key==='currencyTypes'?[{id:'credits',name:'Кредиты'}]:key==='customResourceCount'?0:'public'}};
 globalThis.ui={notifications:{error:()=>{},warn:()=>{},info:()=>{}}};messages=[];
 globalThis.ChatMessage={getSpeaker:()=>({}),applyMode:()=>{},create:async data=>{messages.push(data);return {id:'m',...data};}};
 actor={id:'hero',uuid:'Actor.hero',name:'Hero',documentName:'Actor',type:'character',isOwner:true,flags:{},items:new Map(),system:{inspiration:{value:2},currencies:{credits:100},attributes:{combat:3}},
  testUserPermission:user=>user.id==='p'||user.isGM,getFlag(_scope,key){return this.flags[key];},async setFlag(_scope,key,value){this.flags[key]=value;return this;},
  async update(updates){for(const [key,value] of Object.entries(updates)){
   if(key==='system.inspiration.value')this.system.inspiration.value=value;
   if(key.startsWith('system.currencies.'))this.system.currencies[key.slice(18)]=value;
   if(key.startsWith('flags.vitruviy.'))this.flags[key.slice(15)]=value;
  }return this;},
  async updateEmbeddedDocuments(_type,updates){for(const update of updates){const entry=this.items.get(update._id);
   for(const [key,value] of Object.entries(update)){
    if(key==='system.charges.value')entry.system.charges.value=value;
    if(key==='system.quantity')entry.system.quantity=value;
    if(key.startsWith('flags.vitruviy.'))entry.flags[key.slice(15)]=value;
   }
  }return updates.map(update=>this.items.get(update._id));}};
 item={id:'weapon',uuid:'Actor.hero.Item.weapon',name:'Weapon',isOwner:true,actor,flags:{},getFlag(_scope,key){return this.flags[key];},system:{tier:'C',description:'Text',inspirationEnabled:true,cost:1,chargesEnabled:true,charges:{value:2,max:2},chargeCost:1,quantity:1}};
 actor.items.set(item.id,item);game.actors=[actor];game.user.targets=new Set();
 globalThis.fromUuid=async uuid=>uuid===actor.uuid?actor:uuid===item.uuid?item:null;
}
const message=()=>({content:'<article class="vit-chat"></article>',flags:{vitruviy:{resource:{actorUuid:actor.uuid,cost:1},item:{uuid:item.uuid}}}});

test('Foundry silent cancellation and partial embedded updates are failures',async()=>{
 setup();await assert.rejects(checkedUpdate({update:async()=>undefined},{}),/UpdateCancelled/);
 await assert.rejects(checkedEmbeddedUpdate({updateEmbeddedDocuments:async()=>[{id:'a'}]},'Item',[{_id:'a'},{_id:'b'}]),/UpdateCancelled/);
});



test('partly cancelled multi-item debit restores only committed pools',async()=>{
 setup();const parent={...item,id:'pool',flags:{},system:{chargesEnabled:true,charges:{value:5,max:5}},getFlag(_scope,key){return this.flags[key];}};actor.items.set(parent.id,parent);item.system.chargeSourceId=parent.id;
 const update=actor.updateEmbeddedDocuments.bind(actor);let first=true;
 actor.updateEmbeddedDocuments=async(type,updates)=>{if(first){first=false;return update(type,updates.slice(0,1));}return update(type,updates);};
 await assert.rejects(withItemCharges(item,async()=>{throw Error('should never publish');}),/UpdateCancelled/);
 assert.equal(item.system.charges.value,2);assert.equal(parent.system.charges.value,5);
});



test('GM processes separate client requests serially; duplicate request id is idempotent and foreign actor rejected',async()=>{
 setup();registerResourceAction('testSpend',async actor=>{const value=actor.system.inspiration.value;await Promise.resolve();if(value<1)throw Error('empty');await checkedUpdate(actor,{'system.inspiration.value':value-1});});
 const request={kind:'testSpend',payload:{},time:Date.now()};
 await Promise.all(['client-a','client-b','client-a'].map(id=>serializeOperation(()=>processResourceRequest(actor,id,request,player.id))));
 assert.equal(actor.system.inspiration.value,0);
 await serializeOperation(()=>processResourceRequest(actor,'client-c',request,other.id));assert.equal(actor.getFlag('vitruviy','operationResults.client-c'),undefined);
});
test('a silently cancelled currency debit cannot create money; cancelled credit returns sender money',async()=>{
 setup();const source=actor,target={...actor,id:'target',uuid:'Actor.target',system:{currencies:{credits:0}},flags:{}};
 globalThis.fromUuid=async uuid=>uuid===target.uuid?target:source;
 source.update=async()=>undefined;
 await processCurrencyTransfer(source,{id:'a',targetUuid:target.uuid,currency:'credits',amount:25},player.id);
 assert.equal(source.system.currencies.credits,100);assert.equal(target.system.currencies.credits,0);
 setup();const sender=actor,receiver={...actor,id:'target',uuid:'Actor.target',system:{currencies:{credits:0}},flags:{},update:async()=>undefined};
 globalThis.fromUuid=async uuid=>uuid===receiver.uuid?receiver:sender;
 await processCurrencyTransfer(sender,{id:'b',targetUuid:receiver.uuid,currency:'credits',amount:25},player.id);
 assert.equal(sender.system.currencies.credits,100);assert.equal(receiver.system.currencies.credits,0);
});
test('restart recovery finishes credited currency transfers or refunds uncredited ones once',async()=>{
 for(const credited of [true,false]){
  setup();const source=actor,target={...actor,id:'target',uuid:'Actor.target',system:{currencies:{credits:credited?25:0}},flags:{}};
  source.system.currencies.credits=75;
  const record={protocol:2,status:'pending',targetUuid:target.uuid,currency:'credits',amount:25,receiptId:'receipt'};
  source.flags.currencyTransfers={interrupted:record};
  if(credited)target.flags['currencyReceipts.receipt']={sourceUuid:source.uuid,currency:'credits',amount:25};
  globalThis.fromUuid=async()=>target;
  // Model the nested getFlag collection updated by native Foundry.
  const update=source.update.bind(source);source.update=async changes=>{const result=await update(changes);if(changes['flags.vitruviy.currencyTransfers.interrupted'])source.flags.currencyTransfers.interrupted=changes['flags.vitruviy.currencyTransfers.interrupted'];return result;};
  await recoverCurrencyTransfers();await recoverCurrencyTransfers();
  assert.equal(source.system.currencies.credits,credited?75:100);assert.equal(target.system.currencies.credits,credited?25:0);
 }
});
test('standalone inspiration through GM keeps the player author and private recipients, and rolls back if chat fails',async()=>{
 setup();
 const request={kind:'spendInspiration',payload:{visibility:{whisper:[player.id]}},time:Date.now()};
 await serializeOperation(()=>processResourceRequest(actor,'private-spend',request,player.id));
 assert.equal(actor.system.inspiration.value,1);assert.equal(messages.length,1);assert.equal(messages[0].author,player.id);assert.deepEqual(messages[0].whisper,[player.id]);
 ChatMessage.create=async()=>{throw Error('chat offline');};
 await serializeOperation(()=>processResourceRequest(actor,'failed-spend',request,player.id));
 assert.equal(actor.system.inspiration.value,1);assert.equal(actor.getFlag('vitruviy','operationResults.failed-spend').status,'failed');
});

