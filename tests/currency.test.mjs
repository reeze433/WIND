import test from 'node:test';import assert from 'node:assert/strict';
import {processCurrencyTransfer,enqueueCurrencyTransfer,currencyRecipients,transferCurrency} from '../system/scripts/currency.mjs';
let messages,source,target,users;
function setup(){
  messages=[];
  const make=(id,money,owner)=>({id,uuid:`Actor.${id}`,documentName:'Actor',type:'character',name:id,system:{currencies:{credits:money}},flags:{},isOwner:true,
    testUserPermission:user=>user.isGM||user.id===owner,
    getFlag(_scope,key){return this.flags[key];},
    async setFlag(_scope,key,value){this.flags[key]=value;},
    async update(data){for(const [key,value] of Object.entries(data)){
      if(key.startsWith('system.currencies.'))this.system.currencies[key.slice(18)]=value;
      if(key.startsWith('flags.vitruviy.'))this.flags[key.slice(15)]=value;
    }return this;}
  });
  source=make('source',100,'p1');target=make('target',10,'p2');
  users=[{id:'gm',isGM:true},{id:'p1',character:source},{id:'p2',character:target}];
  users.get=id=>users.find(u=>u.id===id);users.activeGM=users[0];
  users[0].targets=new Set([{actor:target}]);
  globalThis.fromUuid=async uuid=>uuid===target.uuid?target:uuid===source.uuid?source:null;
  globalThis.game={user:users[0],users,actors:new Map([[source.id,source],[target.id,target]]),i18n:{localize:x=>x},settings:{get:()=>[{id:'credits',name:'Кредиты'}]}};
  globalThis.ChatMessage={create:async message=>messages.push(message)};
  globalThis.ui={notifications:{info:()=>{},warn:()=>{},error:()=>{}}};
}
const request=(id='transfer1',amount=25)=>({id,targetUuid:'Actor.target',currency:'credits',amount});
test('player-owned sender can credit another player without recipient ownership; replay does not duplicate',async()=>{
  setup();assert.equal(target.testUserPermission(users[1]),false);
  await processCurrencyTransfer(source,request(),'p1');
  assert.equal(source.system.currencies.credits,75);assert.equal(target.system.currencies.credits,35);
  assert.equal(source.getFlag('vitruviy','currencyTransfers.transfer1').status,'completed');
  await processCurrencyTransfer(source,request(),'p1');assert.equal(source.system.currencies.credits,75);
  assert.equal(messages.length,1);assert.ok(messages[0].whisper.includes('p2'));
});
test('foreign sender, invalid sums, unknown currencies and self transfer cannot move money',async()=>{
  setup();await processCurrencyTransfer(source,request(),'p2');assert.equal(source.system.currencies.credits,100);
  for(const [index,bad] of [{amount:-1},{amount:1.5},{amount:101},{currency:'unknown'},{targetUuid:'Actor.source'}].entries())
    await processCurrencyTransfer(source,{...request(`bad${index}`),...bad},'p1');
  assert.equal(source.system.currencies.credits,100);assert.equal(target.system.currencies.credits,10);
});
test('failed credit returns debit and replay does not repeat it',async()=>{
  setup();target.update=async()=>{throw Error('offline');};
  await processCurrencyTransfer(source,request(),'p1');
  assert.equal(source.system.currencies.credits,100);assert.equal(target.system.currencies.credits,10);
  await processCurrencyTransfer(source,request(),'p1');assert.equal(source.system.currencies.credits,100);
});
test('GM queue serializes competing transfers; insufficient second transfer is rejected',async()=>{
  setup();await Promise.all([enqueueCurrencyTransfer(source,request('a',70),'p1'),enqueueCurrencyTransfer(source,request('b',70),'p1')]);
  assert.equal(source.system.currencies.credits,30);assert.equal(target.system.currencies.credits,80);
});
test('other GM does not process requests; no connected GM prevents submission',async()=>{
  setup();game.user={id:'other',isGM:true};await processCurrencyTransfer(source,request(),'p1');assert.equal(source.system.currencies.credits,100);
  users.activeGM=null;await assert.rejects(transferCurrency(source),/CurrencyNeedsGM/);
  game.user=users[0];
  assert.deepEqual(currencyRecipients(source).map(a=>a.id),['target']);
});

test('transfer dialog uses exactly one targeted token, retains recipient and handles cancel',async()=>{
  setup();let dialog;
  globalThis.foundry={applications:{api:{DialogV2:{prompt:async options=>{dialog=options;return {amount:'7',currency:'credits'};}}}}};
  await transferCurrency(source);
  assert.match(dialog.content,/target/);assert.ok(!dialog.content.includes('name="targetId"'));
  const sent=source.getFlag('vitruviy','currencyTransferRequest');assert.equal(sent.targetUuid,target.uuid);assert.equal(sent.amount,7);
  game.user.targets=new Set();await assert.rejects(transferCurrency(source),/InvalidCurrencyRecipient/);
  game.user.targets=new Set([{actor:target},{actor:source}]);await assert.rejects(transferCurrency(source));
  game.user.targets=new Set([{actor:target}]);foundry.applications.api.DialogV2.prompt=async()=>null;
  await transferCurrency(source);assert.equal(source.getFlag('vitruviy','currencyTransferRequest').id,sent.id);
});
