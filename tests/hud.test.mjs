import test from 'node:test';import assert from 'node:assert/strict';
let system;
globalThis.Hooks={once:()=>{},callAll:(_hook,value)=>system=value};
globalThis.game={i18n:{localize:key=>key}};
const {installHud,itemHudInformation}=await import('../system/scripts/hud.mjs');
test('HUD action rebuild shows current charges, including zero after depletion',async()=>{
  class ActionHandler{addActions(actions,group){this.groups[group.id]=actions;}}
  installHud({api:{ActionHandler,RollHandler:class{},SystemManager:class{}}});
  const actor={isOwner:true,system:{attributes:{}},items:[],effects:[]};
  const pistol={id:'pistol',name:'Малкин',actor,system:{category:'equipment',prepared:true,chargesEnabled:true,charges:{value:9,max:9}}};
  actor.items.push(pistol);actor.items.get=id=>actor.items.find(item=>item.id===id);
  const handler=new system.api.SystemManager().getActionHandler();handler.actor=actor;handler.groups={};
  await handler.buildSystemActions();assert.equal(handler.groups.equipment[0].info1.text,'9/9');
  pistol.system.charges.value=0;await handler.buildSystemActions();assert.equal(handler.groups.equipment[0].info1.text,'0/9');
  pistol.system.charges.value=6;await handler.buildSystemActions();assert.equal(handler.groups.equipment[0].info1.text,'6/9');
});
test('items with shared charge sources show their balance; items without charges stay unchanged',()=>{
  const source={name:'Медикаменты',system:{chargesEnabled:true,charges:{value:2,max:3}}};
  const item={actor:{items:{get:id=>id==='pool'?source:null}},system:{chargeSourceId:'pool'}};
  const info=itemHudInformation(item);assert.equal(info.info2.text,'2/3');assert.match(info.info2.title,/Медикаменты/);assert.ok(!info.info1);
  item.system.chargeSourceId='';assert.deepEqual(itemHudInformation(item),{});
});

test('HUD tracks only prepared cards and removes them immediately on unprepare',async()=>{
 class ActionHandler{addActions(actions,group){this.groups[group.id]=actions;}}
 installHud({api:{ActionHandler,RollHandler:class{},SystemManager:class{}}});
 const prepared={id:'ready',name:'Ready',system:{category:'custom',prepared:true}},stored={id:'stored',name:'Stored',system:{category:'custom',prepared:false}};
 const actor={isOwner:true,system:{attributes:{}},items:[prepared,stored],effects:[]};const handler=new system.api.SystemManager().getActionHandler();handler.actor=actor;handler.groups={};
 await handler.buildSystemActions();assert.deepEqual(handler.groups.custom.map(i=>i.id),['ready']);
 prepared.system.prepared=false;stored.system.prepared=true;await handler.buildSystemActions();assert.deepEqual(handler.groups.custom.map(i=>i.id),['stored']);
});
