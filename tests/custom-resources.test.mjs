import test from 'node:test';import assert from 'node:assert/strict';
globalThis.foundry={applications:{api:{ApplicationV2:class{},HandlebarsApplicationMixin:base=>base}}};
const {resourceDefinitions,customResourceViews,setCustomResourceValue,recoverCustomResources,resourceConfiguration}=await import('../system/scripts/custom-resources.mjs');
let count,names,actor;
function setup(){
 count=1;names=['Импульс'];
 globalThis.game={user:{id:'gm',isGM:true},users:{activeGM:{id:'gm'}},i18n:{localize:key=>key},settings:{get:(_scope,key)=>key==='customResourceCount'?count:names}};
 globalThis.ui={notifications:{warn:()=>{}}};
 actor={uuid:'Actor.hero',isOwner:true,name:'Hero',flags:{},system:{attributes:{thinking:5,combat:3},customResources:{r0:{value:1,maximum:'(Мышление+Сражение)*2',recovery:'floor(Мышление/2)',recoveryMode:'round'}}},getFlag(_s,key){return this.flags[key];},async update(updates){
   for(const [key,value] of Object.entries(updates)){
     if(key.startsWith('flags.vitruviy.'))this.flags[key.slice(15)]=value;
     if(key==='system.customResources.r0.value')this.system.customResources.r0.value=value;
   }return this;
 }};
}
test('zero counters hide without deleting values; maxima follow changing effective attributes',()=>{
 setup();assert.equal(customResourceViews(actor)[0].maximum,16);
 actor.system.attributes.thinking=7;assert.equal(customResourceViews(actor)[0].maximum,20);
 count=0;assert.deepEqual(customResourceViews(actor),[]);assert.equal(actor.system.customResources.r0.value,1);
 count=1;names=['Пси'];assert.equal(resourceDefinitions()[0].name,'Пси');assert.equal(customResourceViews(actor)[0].value,1);
});
test('setting current value checks ownership, bounds and integer values',async()=>{
 setup();await setCustomResourceValue(actor,'r0',12);assert.equal(actor.system.customResources.r0.value,12);
 for(const value of [-1,17,1.5])await assert.rejects(setCustomResourceValue(actor,'r0',value));
 actor.isOwner=false;await assert.rejects(setCustomResourceValue(actor,'r0',1));
});
test('round recovery deduplicates linked tokens and replayed or rewound rounds',async()=>{
 setup();const combat={id:'fight',round:1,combatants:[{actor},{actor}],combatant:{id:'c',actor}};
 await recoverCustomResources(combat,{round:1});assert.equal(actor.system.customResources.r0.value,3);
 await recoverCustomResources(combat,{round:1});assert.equal(actor.system.customResources.r0.value,3);
 combat.round=2;await recoverCustomResources(combat,{round:2});assert.equal(actor.system.customResources.r0.value,5);
 combat.round=1;await recoverCustomResources(combat,{round:1});assert.equal(actor.system.customResources.r0.value,5);
});
test('turn recovery runs only on own turn, caps at maximum and requires active GM',async()=>{
 setup();actor.system.customResources.r0.recoveryMode='turn';actor.system.customResources.r0.value=15;
 const combat={id:'fight',round:1,combatants:[{actor}],combatant:{id:'other',actor:{uuid:'Actor.other'}}};
 await recoverCustomResources(combat,{turn:1});assert.equal(actor.system.customResources.r0.value,15);
 combat.combatant={id:'c',actor};await recoverCustomResources(combat,{turn:2});assert.equal(actor.system.customResources.r0.value,16);
 game.user.id='player';combat.round=2;actor.system.customResources.r0.value=0;
 await recoverCustomResources(combat,{round:2});assert.equal(actor.system.customResources.r0.value,0);
});
test('bad formulas are visible as errors; hidden resources do not regenerate',async()=>{
 setup();actor.system.customResources.r0.maximum='1/0';assert.ok(customResourceViews(actor)[0].error);
 count=0;await recoverCustomResources({id:'fight',round:1,combatants:[{actor}]},{round:1});assert.equal(actor.system.customResources.r0.value,1);
});

test('one-sixth recovery follows recalculated maximum on each new round',async()=>{
 setup();actor.system.customResources.r0.recovery='floor(Максимум/6)';
 const combat={id:'sixth',round:1,combatants:[{actor}]};
 await recoverCustomResources(combat,{round:1});assert.equal(actor.system.customResources.r0.value,3);
 actor.system.attributes.thinking=9;combat.round=2;
 await recoverCustomResources(combat,{round:2});assert.equal(actor.system.customResources.r0.value,7);
 await recoverCustomResources(combat,{round:2});assert.equal(actor.system.customResources.r0.value,7);
});

test('configuration validates before saving: inactive maximum source is ignored, invalid values stay errors',()=>{
 setup();const state=customResourceViews(actor)[0];
 const values={maximumMode:'formula',maximum:'24',maximumItemId:'missing',recovery:'floor(Максимум/6)',recoveryMode:'round',value:'12'};
 const entry=resourceConfiguration(actor,'r0',state,values);assert.equal(entry.value,12);assert.equal(entry.maximum,'24');
 assert.throws(()=>resourceConfiguration(actor,'r0',state,{...values,maximum:'1/0'}),/InvalidResourceFormula/);
 assert.throws(()=>resourceConfiguration(actor,'r0',state,{...values,value:'25'}),/InvalidResourceValue/);
 const full=resourceConfiguration(actor,'r0',state,{...values,fill:'on'});assert.equal(full.value,24);
});
