import test from 'node:test';
import assert from 'node:assert/strict';
import {applyDamage} from '../system/scripts/damage.mjs';
let values, updates = [], applied = false;
const actor = {isOwner:true,type:'character',name:'Target',system:{health:{value:10,max:15}},getFlag:()=>applied,
 async update(data){updates.push(data);this.system.health.value=data['system.health.value'];applied=true;return this;}};
const message = {id:'roll1',uuid:'ChatMessage.roll1',getFlag:()=>({dealsDamage:true,potentialDamage:12,targets:[{uuid:'Scene.s.Token.t',name:'Target'}]})};
globalThis.game={user:{isGM:true,id:'gm'},i18n:{localize:key=>key}};
globalThis.canvas={tokens:{controlled:[]}};
globalThis.ui={notifications:{warn:()=>{},info:()=>{}}};
globalThis.foundry={applications:{api:{DialogV2:{prompt:async()=>values}}}};
globalThis.fromUuid=async()=>({actor});
test('GM applies editable damage to saved target, clamps HP and supports repeated confirmed application',async()=>{
 values={target:'Scene.s.Token.t',amount:'3'};await applyDamage(message);assert.equal(actor.system.health.value,7);
 await applyDamage(message);assert.equal(updates.length,2);assert.equal(actor.system.health.value,4);
 applied=false;values.amount='99';await applyDamage(message);assert.equal(actor.system.health.value,0);
});
test('player rejected; cancellation and invalid target or amount never update HP',async()=>{
 game.user.isGM=false;await assert.rejects(applyDamage(message));game.user.isGM=true;
 const count=updates.length;values=null;await applyDamage(message);
 values={target:'other',amount:'2'};await assert.rejects(applyDamage(message));
 values={target:'Scene.s.Token.t',amount:'-2'};await assert.rejects(applyDamage(message));assert.equal(updates.length,count);
});
test('controlled GM token is accepted without an initiator target',async()=>{
 applied=false;canvas.tokens.controlled=[{document:{uuid:'Scene.s.Token.gm'},name:'Selected'}];
 values={target:'Scene.s.Token.gm',amount:'0'};
 await applyDamage({...message,id:'roll2',getFlag:()=>({dealsDamage:true,potentialDamage:0,targets:[]})});
 assert.equal(updates.at(-1)['flags.vitruviy.damageApplied.roll2'].amount,0);
});

test('healing increases HP, caps at maximum, can be repeated and validates mode',async()=>{
 applied=false;actor.system.health.value=5;
 values={target:'Scene.s.Token.t',amount:'3',mode:'healing'};
 await applyDamage(message);assert.equal(actor.system.health.value,8);
 assert.equal(updates.at(-1)['flags.vitruviy.damageApplied.roll1'].mode,'healing');
 await applyDamage(message);assert.equal(actor.system.health.value,11);
 applied=false;values.amount='99';await applyDamage(message);assert.equal(actor.system.health.value,15);
 applied=false;values.mode='invalid';await assert.rejects(applyDamage(message));
 assert.equal(actor.system.health.value,15);
});

test('GM-confirmed damage ignores public or hidden response results without an override checkbox',async()=>{
 const saved=actor.getFlag, savedFlag=message.getFlag;
 message.getFlag=(_scope,key)=>key==='check'?{total:1}:{dealsDamage:true,potentialDamage:3,targets:[{uuid:'Scene.s.Token.t',name:'Target'}]};
 for(const response of [{total:99},{hidden:true}]){
  actor.getFlag=(_scope,key)=>key.startsWith('defenses.')?response:undefined;
  actor.system.health.value=10;values={target:'Scene.s.Token.t',amount:'3',mode:'damage'};
  await applyDamage(message);assert.equal(actor.system.health.value,7);
 }
 actor.getFlag=saved;message.getFlag=savedFlag;
});

test('target tabs open Targeted first and retain checkbox choices when switching',async()=>{
 const {valueTargetTabs,bindValueTargets}=await import('../system/scripts/damage.mjs');
 const html=valueTargetTabs({targeted:[{uuid:'a',name:'A'}],selected:[{uuid:'b',name:'B'}]});
 assert.match(html,/data-value-tab="targeted" aria-selected="true"/);assert.match(html,/data-value-panel="selected" hidden/);
 assert.match(html,/name="target0"/);assert.match(html,/name="target1"/);
 const tabs=['targeted','selected'].map(key=>({dataset:{valueTab:key},addEventListener(_e,fn){this.click=fn},setAttribute(_k,v){this.selected=v}}));
 const panels=['targeted','selected'].map(key=>({dataset:{valuePanel:key},hidden:key==='selected'}));
 bindValueTargets({querySelectorAll:selector=>selector.includes('tab]')?tabs:panels});
 tabs[1].click();assert.deepEqual(panels.map(p=>p.hidden),[true,false]);tabs[0].click();assert.deepEqual(panels.map(p=>p.hidden),[false,true]);
});

test('two selected targets receive independent multipliers',async()=>{
 const resolve=globalThis.fromUuid;
 const other={...actor,uuid:'Actor.other',system:{health:{value:10,max:15}},async update(data){this.system.health.value=data['system.health.value'];return this;}};
 actor.uuid='Actor.first';actor.system.health.value=10;
 canvas.tokens.controlled=[{document:{uuid:'Scene.s.Token.other'},name:'Other'}];
 globalThis.fromUuid=async uuid=>({actor:uuid==='Scene.s.Token.other'?other:actor});
 values={target0:'on',target1:'on',amount:'4',multiplier0:'0.5',multiplier1:'2',mode:'damage'};
 await applyDamage(message);assert.equal(actor.system.health.value,8);assert.equal(other.system.health.value,2);
 globalThis.fromUuid=resolve;canvas.tokens.controlled=[];
});

test('only active target tab contributes rows, duplicate token keeps one selected row',async()=>{
 const {selectedValueRows}=await import('../system/scripts/damage.mjs');const rows=[{uuid:'a'},{uuid:'b'},{uuid:'a'}];
 const values={target0:'on',target1:'on',target2:'on',valueTargetTab:'targeted'};
 assert.deepEqual([...selectedValueRows(rows,1,values)],[['a',0]]);
 values.valueTargetTab='selected';assert.deepEqual([...selectedValueRows(rows,1,values)],[['b',1],['a',2]]);
});

test('duplicate target is resolved once for preview; conflicting linked token values abort before HP changes',async()=>{
 const resolve=globalThis.fromUuid, prompt=foundry.applications.api.DialogV2.prompt;
 let reads=0;globalThis.fromUuid=async uuid=>{reads++;return resolve(uuid);};
 canvas.tokens.controlled=[{document:{uuid:'Scene.s.Token.t'},name:'Duplicate'}];values=null;
 await applyDamage(message);assert.equal(reads,1);
 canvas.tokens.controlled=[{document:{uuid:'Scene.s.Token.other'},name:'Linked'}];
 values={target0:'on',target1:'on',amount:'4',multiplier0:'1',multiplier1:'2'};
 const before=actor.system.health.value;await assert.rejects(applyDamage(message),/ValueConflictingTokens/);assert.equal(actor.system.health.value,before);
 globalThis.fromUuid=resolve;canvas.tokens.controlled=[];foundry.applications.api.DialogV2.prompt=prompt;
});

test('apply value reads current GM or active author targets, never stale saved selection',async()=>{
 const {currentValueTargets}=await import('../system/scripts/damage.mjs');
 const token=id=>({document:{uuid:id},name:id,actor:{}}),saved={targets:[{uuid:'old'}]},author={id:'player',active:true,targets:new Set([token('player-new')])};
 game.user.targets=new Set([token('gm-new')]);assert.deepEqual(currentValueTargets({author},saved).map(t=>t.uuid),['gm-new']);
 game.user.targets.clear();assert.deepEqual(currentValueTargets({author},saved).map(t=>t.uuid),['player-new']);
 author.targets.clear();assert.deepEqual(currentValueTargets({author},saved),[]);
 author.targets.add(token('changed-again'));assert.deepEqual(currentValueTargets({author},saved).map(t=>t.uuid),['changed-again']);
 author.active=false;assert.deepEqual(currentValueTargets({author},saved),saved.targets);
 delete game.user.targets;
});
