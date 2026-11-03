import test from 'node:test';import assert from 'node:assert/strict';
import {prepareItemEffect,effectData,applyItemEffect,itemEffectViews} from '../system/scripts/item-effects.mjs';
let source,target,item,gm,player;
function setup(){
  gm={id:'gm',isGM:true};player={id:'player'};
  const users=[gm,player];users.get=id=>users.find(u=>u.id===id);users.activeGM=gm;
  source={uuid:'Actor.source',testUserPermission:u=>u.id==='player'};
  target={uuid:'Actor.target',name:'Target',isOwner:true,system:{attributes:{combat:3}},flags:{},effects:[],getFlag:(_s,key)=>target.flags[key],async setFlag(_s,key,value){this.flags[key]=value;},
    async update(updates){for(const [key,value] of Object.entries(updates))if(key.startsWith('flags.vitruviy.'))this.flags[key.slice(15)]=value;return this;},
    async createEmbeddedDocuments(type,data){assert.equal(type,'ActiveEffect');for(const entry of data){this.effects.push({...entry,id:'buff',getFlag(_s,key){return this.flags.vitruviy[key];},async update(update){Object.assign(this,update);return this;}});}return this.effects.slice(-data.length);}};
  item={uuid:'Actor.source.Item.buff',actor:source,name:'Биохакинг',system:{effectEnabled:true,effectTarget:'target',effectAttribute:'combat',effectBonus:1}};
  globalThis.game={user:gm,users,i18n:{localize:key=>key}};
  globalThis.fromUuid=async uuid=>[source,target,item].find(doc=>doc.uuid===uuid);
  game.user.targets=new Set([{actor:target}]);
}
test('any item may configure a fixed attribute or choose one; cancel and ambiguous target abort',async()=>{
  setup();assert.equal((await prepareItemEffect(item)).attribute,'combat');
  item.system.effectAttribute='choose';globalThis.foundry={applications:{api:{DialogV2:{prompt:async()=> 'thinking'}}}};
  assert.equal((await prepareItemEffect(item)).attribute,'thinking');
  foundry.applications.api.DialogV2.prompt=async()=>null;assert.equal(await prepareItemEffect(item),false);
  game.user.targets=new Set();await assert.rejects(prepareItemEffect(item),/EffectSelectTarget/);
});
test('native Foundry14 changes are additive and reversible, without writing base attributes',async()=>{
  setup();const snapshot=await prepareItemEffect(item);const data=effectData(snapshot,'m1');
  assert.deepEqual(data.system.changes,[{key:'system.attributes.combat',type:'add',value:1,phase:'initial',priority:20}]);
  const message={id:'m1',getFlag:()=>snapshot};await applyItemEffect(message,'player');
  assert.equal(target.effects.length,1);assert.equal(target.system.attributes.combat,3);
  await applyItemEffect(message,'player');assert.equal(target.effects.length,1);
  await applyItemEffect({...message,id:'m2'},'player');assert.equal(target.effects.length,1);
  assert.equal(itemEffectViews(target).length,1);target.effects[0].disabled=true;assert.equal(itemEffectViews(target).length,0);
  target.effects=[];assert.equal(itemEffectViews(target).length,0);assert.equal(target.system.attributes.combat,3);
});
test('invalid changes and unauthorized initiators are rejected',async()=>{
  setup();assert.throws(()=>effectData({attribute:'currencies.cash',bonus:1},'m'));
  const snapshot=await prepareItemEffect(item);await assert.rejects(applyItemEffect({id:'bad',getFlag:()=>snapshot},'gm'),/NoPermission/);
  game.users.activeGM=null;game.user=player;game.user.targets=new Set([{actor:target}]);target.isOwner=false;await assert.rejects(prepareItemEffect(item),/EffectNeedsGM/);
});
