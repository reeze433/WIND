import test from 'node:test';import assert from 'node:assert/strict';
import {applyDamage,multipliedValue,bindValueModifiers} from '../system/scripts/damage.mjs';
import {defend,recordDefense,defenseFor} from '../system/scripts/targets.mjs';
import {withItemCharges,refundItemCharges} from '../system/scripts/charges.mjs';
import {toggleItemInspiration} from '../system/scripts/resources.mjs';
let actor,item,message,messages,choice,prompts,docs;
function setup(){
 messages=[];prompts=[];choice=null;docs=new Map();const gm={id:'gm',isGM:true},users=[gm];users.activeGM=gm;users.get=id=>users.find(user=>user.id===id);
 globalThis.game={user:gm,users,messages,i18n:{localize:key=>key},settings:{get:(_s,key)=>({customResourceCount:1,customResourceNames:['Fuel'],responseRollVisibility:'public'})[key]??'public'}};
 globalThis.ui={notifications:{warn:()=>{},info:()=>{},error:()=>{}}};globalThis.canvas={tokens:{controlled:[]}};
 globalThis.foundry={applications:{api:{DialogV2:{prompt:async config=>{prompts.push(config);return typeof choice==='function'?choice(config):choice;}}}}};
 actor={id:'a',uuid:'Actor.a',name:'Actor',type:'character',isOwner:true,flags:{},items:new Map(),system:{health:{value:20,max:20},attributes:{combat:3},inspiration:{value:1},customResources:{r0:{value:8,maximum:'10'}}},getFlag(_s,key){return this.flags[key];},async update(changes){for(const [key,value]of Object.entries(changes))set(this,key,value);return this;},async updateEmbeddedDocuments(type,updates){for(const update of updates){const item=this.items.get(update._id);for(const [key,value]of Object.entries(update))if(key!=='_id')set(item,key,value);}return updates.map(update=>this.items.get(update._id));}};
 item={id:'item',uuid:'Actor.a.Item.item',actor,isOwner:true,name:'Item',flags:{},system:{chargesEnabled:true,charges:{value:5,max:10},chargeCost:2,quantity:3,quantityUsage:'consume',quantityCost:1,customResourceId:'r0',customResourceCost:2},getFlag(_s,key){return this.flags[key];}};actor.items.set(item.id,item);
 message={id:'attack',uuid:'ChatMessage.attack',visible:true,getFlag:(_s,key)=>key==='item'?{dealsDamage:true,potentialDamage:4,targets:[{uuid:'Scene.s.Token.target',name:'Actor'}]}:key==='check'?{total:4}:null,async update(){return this;}};
 docs.set(actor.uuid,actor);docs.set(message.uuid,message);docs.set('Scene.s.Token.target',{actor});globalThis.fromUuid=async uuid=>docs.get(uuid);
 globalThis.ChatMessage={getSpeaker:()=>({}),create:async data=>{const result={...data,id:'m'+messages.length,visible:true,getFlag:(_s,key)=>data.flags?.vitruviy?.[key]};messages.push(result);return result;}};
 globalThis.Roll=class{constructor(){this.dice=[];}async evaluate(){this.dice=[{results:[{result:4,active:true}]}];return this;}toJSON(){return {};}};
}
function set(target,key,value){if(key.startsWith('flags.vitruviy.'))target.flags[key.slice(15)]=value;else{const parts=key.split('.');let entry=target;for(const part of parts.slice(0,-1))entry=entry[part]??={};entry[parts.at(-1)]=value;}}
test('four multipliers are applied once to the base value, half rounds down and invalid/overflow values fail',()=>{
 setup();assert.deepEqual([0,.5,1,2].map(factor=>multipliedValue(7,factor)),[0,3,7,14]);assert.equal(multipliedValue(0,2),0);
 for(const [amount,factor]of [[-1,1],[1.5,1],[1,.1],[1,Infinity],[Number.MAX_SAFE_INTEGER,2]])assert.throws(()=>multipliedValue(amount,factor),/InvalidCheck/);
});
test('modifier preview follows edits and changing x2 to x0.5 does not compound values',()=>{
 setup();const amount={value:'7'},factor={value:'1'},output={},listeners={};const root={querySelector:selector=>selector==='[name="amount"]'?amount:selector==='[data-value-preview]'?output:factor,addEventListener:(name,fn)=>listeners[name]=fn};
 bindValueModifiers(root);assert.equal(output.textContent,'7');factor.value='2';listeners.change();assert.equal(output.textContent,'14');factor.value='.5';listeners.change();assert.equal(output.textContent,'3');amount.value='9';listeners.input();assert.equal(output.textContent,'4');assert.equal(amount.value,'9');
});
test('repeated value confirmations change HP repeatedly, including zero, half, double and healing',async()=>{
 setup();choice={target0:'on',amount:'4',multiplier:'.5',mode:'damage'};await applyDamage(message);await applyDamage(message);assert.equal(actor.system.health.value,16);
 choice.multiplier='0';await applyDamage(message);assert.equal(actor.system.health.value,16);choice.multiplier='2';await applyDamage(message);assert.equal(actor.system.health.value,8);
 choice={target0:'on',amount:'7',multiplier:'.5',mode:'healing'};await applyDamage(message);await applyDamage(message);assert.equal(actor.system.health.value,14);assert.equal(actor.getFlag('vitruviy','damageApplied.attack').applications,6);
 for(const factor of ['0','0.5','1','2'])assert.ok(prompts[0].content.includes(`value="${factor}"`));
});
test('repeated hidden responses use the newest result while the public marker stays private',async()=>{
 setup();game.settings.get=()=> 'gm';const result={attribute:'combat',total:1,mode:'normal',attempts:[],selected:0};await recordDefense(actor,message,result);await recordDefense(actor,message,{...result,total:3});assert.equal(messages.length,2);assert.equal(defenseFor(actor,message).total,3);assert.deepEqual(actor.getFlag('vitruviy','defenses.attack'),{hidden:true});game.user={id:'p',isGM:false};assert.deepEqual(defenseFor(actor,message),{hidden:true});
});
test('response double click while prompt is pending is ignored, then a new completed click rolls again',async()=>{
 setup();let release;choice=()=>new Promise(resolve=>release=resolve);const first=defend(actor,message);await defend(actor,message);assert.equal(prompts.length,1);release({attribute:'combat',mode:'normal',rollMode:'public'});await first;choice={attribute:'combat',mode:'normal',rollMode:'public'};await defend(actor,message);assert.equal(messages.length,2);assert.equal(prompts.length,2);
});
test('explicit repeated refunds restore charges, quantity and custom resource; maxima remain bounded',async()=>{
 setup();const receipt=await withItemCharges(item,async(uses,useId,quantity,customResource)=>({actorUuid:actor.uuid,uses,useId,quantity,customResource}));const refund={id:'receipt',uuid:'ChatMessage.receipt',visible:true,getFlag:()=>receipt};docs.set(refund.uuid,refund);
 assert.deepEqual([item.system.charges.value,item.system.quantity,actor.system.customResources.r0.value],[3,2,6]);
 for(let i=0;i<4;i++)await refundItemCharges(refund,{repeat:true});assert.deepEqual([item.system.charges.value,item.system.quantity,actor.system.customResources.r0.value],[10,6,10]);
 await refundItemCharges(refund);assert.equal(item.system.quantity,6);actor.isOwner=false;await assert.rejects(refundItemCharges(refund,{repeat:true}),/NoPermission/);
});
test('charge refund double click remains locked until update finishes',async()=>{
 setup();const receipt=await withItemCharges(item,async(uses,useId,quantity,customResource)=>({actorUuid:actor.uuid,uses,useId,quantity,customResource}));const refund={id:'receipt',visible:true,getFlag:()=>receipt};let release;const original=actor.updateEmbeddedDocuments.bind(actor);actor.updateEmbeddedDocuments=async(...args)=>{await new Promise(resolve=>release=resolve);return original(...args);};
 const first=refundItemCharges(refund,{repeat:true});for(let i=0;i<6&&!release;i++)await Promise.resolve();await refundItemCharges(refund,{repeat:true});release();await first;assert.equal(item.system.charges.value,5);assert.equal(item.system.quantity,3);
});
test('inspiration receipt rejects repeated refunds even when old clients request repeatRefund',async()=>{
 setup();const receipt={id:'inspiration',visible:true,getFlag:()=>({actorUuid:actor.uuid,cost:2,useId:'u',refundOnly:true})};actor.flags['resourceUses.u']=true;
 await toggleItemInspiration(receipt,{repeatRefund:true});await toggleItemInspiration(receipt,{repeatRefund:true});assert.equal(actor.system.inspiration.value,3);assert.equal(actor.getFlag('vitruviy','resourceUses.u'),false);await toggleItemInspiration(receipt);assert.equal(actor.system.inspiration.value,3);
});
test('recursive Foundry flag merges cannot leave public numbers on a hidden reroll or keep a later public reply hidden',async()=>{
 setup();actor.update=async changes=>{for(const [key,value]of Object.entries(changes)){
  if(key.startsWith('flags.vitruviy.')){const path=key.slice(15),position=path.lastIndexOf('.-=');if(position>=0){delete actor.flags[path.slice(0,position)]?.[path.slice(position+3)];}else actor.flags[path]={...actor.flags[path],...value};}
 }return actor;};
 const result={attribute:'combat',total:1,mode:'normal',attempts:[],selected:0};await recordDefense(actor,message,result);assert.equal(actor.getFlag('vitruviy','defenses.attack').total,1);
 await recordDefense(actor,message,{...result,total:3},game.user,[],{visibility:'gm'});assert.deepEqual(actor.getFlag('vitruviy','defenses.attack'),{hidden:true});
 await recordDefense(actor,message,{...result,total:2},game.user,[],{visibility:'public'});assert.deepEqual(actor.getFlag('vitruviy','defenses.attack'),{attribute:'combat',total:2});assert.equal(defenseFor(actor,message).total,2);
});


