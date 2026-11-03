import test from 'node:test';
import assert from 'node:assert/strict';
import * as authority from '../system/scripts/operations.mjs';

test('two independently imported clients use the GM request transport, spend the current balance and receive acknowledgements',async()=>{
 const gm={id:'gm',isGM:true},player={id:'player'},users=[gm,player];users.activeGM=gm;users.get=id=>users.find(user=>user.id===id);
 globalThis.game={user:player,users,i18n:{localize:key=>key}};
 globalThis.ui={notifications:{error:()=>{},warn:()=>{}}};
 const listeners=new Map();let next=0;
 globalThis.Hooks={on:(_event,handler)=>{listeners.set(++next,handler);return next;},off:(_event,id)=>listeners.delete(id),once:()=>{}};
 let server=Promise.resolve(),localCalls=0;
 const actor={uuid:'Actor.hero',isOwner:true,system:{inspiration:{value:2}},flags:{},testUserPermission:user=>user.id===player.id,
  getFlag(_scope,key){return this.flags[key];},async update(changes){
   const origin=game.user.id;
   const requestEntries=[];
   for(const [key,value] of Object.entries(changes)){
    if(key==='system.inspiration.value')this.system.inspiration.value=value;
    if(key.startsWith('flags.vitruviy.'))this.flags[key.slice(15)]=value;
    if(key.startsWith('flags.vitruviy.operationRequests.')&&!key.includes('-='))requestEntries.push([key.split('.').at(-1),value]);
   }
   const nested={flags:{vitruviy:{operationRequests:Object.fromEntries(requestEntries)}}};
   for(const listener of [...listeners.values()])listener(this,nested,{},origin);
   for(const [id,request] of requestEntries)server=server.then(async()=>{
    game.user=gm;
    try{await authority.serializeOperation(()=>authority.processResourceRequest(actor,id,request,origin));}
    finally{game.user=player;}
   });
   return this;
  }};
 authority.registerResourceAction('spend',async actor=>{
  const balance=actor.system.inspiration.value;await Promise.resolve();
  if(balance<1)throw Error('empty');
  await actor.update({'system.inspiration.value':balance-1});
 });
 const a=await import('../system/scripts/operations.mjs?client-a'),b=await import('../system/scripts/operations.mjs?client-b');
 a.registerResourceOperations();b.registerResourceOperations();
 await Promise.all([a.resourceOperation(actor,'spend',{},()=>localCalls++),b.resourceOperation(actor,'spend',{},()=>localCalls++)]);
 await server;
 assert.equal(actor.system.inspiration.value,0);assert.equal(localCalls,0);
 const results=Object.entries(actor.flags).filter(([key])=>key.startsWith('operationResults.')).map(([,value])=>value.status);
 assert.deepEqual(results,['completed','completed']);
 // The response listeners are removed; only each client's permanent request listener remains.
 assert.equal(listeners.size,2);
});
