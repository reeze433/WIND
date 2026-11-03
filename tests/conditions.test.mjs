import test from 'node:test';
import assert from 'node:assert/strict';
import {needsWound,syncWound,conditionViews,WOUNDED} from '../system/scripts/conditions.mjs';
test('wound starts at two missing HP, persists through partial healing and clears at full HP',async()=>{
  let active=false;
  const actor={uuid:'Actor.wound',isOwner:true,system:{health:{value:9,max:10}},toggleStatusEffect:async(id,options)=>{assert.equal(id,WOUNDED);active=options.active;}};
  assert.equal(needsWound(actor.system.health),false);
  await syncWound(actor);assert.equal(active,false);
  actor.system.health.value=8;await syncWound(actor);assert.equal(active,true);
  actor.system.health.value=9;await syncWound(actor);assert.equal(active,true);
  actor.system.health.value=10;await syncWound(actor);assert.equal(active,false);
  actor.isOwner=false;actor.system.health.value=0;await syncWound(actor);assert.equal(active,false);
});
test('token status uses editable catalog description without exposing private information',()=>{
  globalThis.CONFIG={statusEffects:[{id:'blind',name:'Blind',img:'blind.svg'}]};
  globalThis.game={i18n:{localize:x=>x},items:[{getFlag:()=> 'blind',name:'Слепота',img:'custom.webp',system:{description:'<опасно>',privateDescription:'SECRET'}}]};
  const views=conditionViews({statuses:new Set(['blind']),effects:[]});
  assert.equal(views.length,1);assert.equal(views[0].img,'custom.webp');
  assert.ok(views[0].tooltip.includes('&lt;опасно&gt;'));assert.ok(!views[0].tooltip.includes('SECRET'));
});
