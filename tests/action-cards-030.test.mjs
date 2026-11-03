import test from 'node:test';import assert from 'node:assert/strict';
import {rollItem,rollActionCard,refundActionResources,actionResourcesReturned,applyActionEffect,assignActionTargets,addActionControls} from '../system/scripts/items.mjs';
import {toggleItemInspiration} from '../system/scripts/resources.mjs';
import {processResourceRequest} from '../system/scripts/operations.mjs';
import {retireRedlineEffects} from '../system/scripts/retired-redline.mjs';
import {headerBackground,DEFAULT_HEADER_BACKGROUNDS} from '../system/scripts/presentation.mjs';
let actor,item,messages,dice,prompts,answer,lookup,failChat;
function setup(){
 messages=[];dice=[];prompts=[];answer={mode:'normal',rollMode:'public'};failChat=false;lookup=new Map();
 const gm={id:'gm',isGM:true},player={id:'p',isGM:false};const users=[gm,player];users.activeGM=gm;users.get=id=>users.find(u=>u.id===id);
 globalThis.game={user:gm,users,i18n:{localize:k=>k},settings:{get:(_s,k)=>k==='criticalOnDoubleSuccess'?true:k==='customResourceCount'?0:'public'}};
 globalThis.canvas={tokens:{controlled:[]}};
 globalThis.foundry={applications:{ux:{TextEditor:{enrichHTML:async text=>text}},api:{DialogV2:{prompt:async config=>{prompts.push(config);return answer;}}}}};
 globalThis.ui={notifications:{error:()=>{},warn:()=>{},info:()=>{}}};
 actor={uuid:'Actor.a',id:'a',name:'Hero',isOwner:true,effects:[],flags:{},items:new Map(),system:{inspiration:{value:3},attributes:{combat:2},health:{value:12,max:12}},testUserPermission:()=>true,getFlag(_s,k){return this.flags[k]},async update(data){for(const[k,v]of Object.entries(data)){if(k==='system.inspiration.value')this.system.inspiration.value=v;else if(k.startsWith('flags.vitruviy.'))this.flags[k.slice(15)]=v;}return this;},async updateEmbeddedDocuments(_type,updates){for(const data of updates){const i=this.items.get(data._id);for(const[k,v]of Object.entries(data)){if(k==='system.charges.value')i.system.charges.value=v;if(k==='system.quantity')i.system.quantity=v;if(k.startsWith('flags.vitruviy.'))i.flags[k.slice(15)]=v;}}return updates.map(d=>this.items.get(d._id));}};
 item={uuid:'Actor.a.Item.i',id:'i',name:'Weapon <x>',img:'icon.png',isOwner:true,actor,flags:{redline:{kind:'resonator'}},getFlag(_s,k){return this.flags[k]},system:{quantity:2,quantityUsage:'consume',quantityCost:1,rollEnabled:true,dealsDamage:true,attribute:'combat',rollBranch:'attack',tier:'S',description:'Public',privateDescription:'PRIVATE',chargesEnabled:true,charges:{value:2,max:2},chargeCost:1,inspirationEnabled:true,cost:1}};
 actor.items.set(item.id,item);lookup.set(item.uuid,item);lookup.set(actor.uuid,actor);
 globalThis.fromUuid=async uuid=>lookup.get(uuid);
 globalThis.ChatMessage={getSpeaker:()=>({}),applyMode:(data,mode)=>data.mode=mode,create:async data=>{if(failChat)throw Error('offline');const id='m'+messages.length;const m={...data,id,uuid:'ChatMessage.'+id,visible:true,author:{id:data.author??game.user.id},getFlag(_s,k){return this.flags.vitruviy[k]},async update(changes){for(const[k,v]of Object.entries(changes)){if(k==='flags.vitruviy.item.targets')this.flags.vitruviy.item.targets=v;else if(k.startsWith('flags.vitruviy.'))this.flags.vitruviy[k.slice(15)]=v;else this[k]=v;}return this;}};messages.push(m);lookup.set(m.uuid,m);return m;}};
 globalThis.Roll=class{constructor(formula){this.formula=formula;}async evaluate(){dice.push(this.formula);this.dice=[{results:[{result:6,active:true},{result:4,active:true}]}];return this;}};
}
test('activation consumes configured resources exactly once, without dice, dialogs, targets or private text',async()=>{
 setup();game.user.targets=new Set([{name:'Enemy',actor,document:{uuid:'Scene.s.Token.t'}}]);const m=await rollItem(item);assert.equal(messages.length,1);assert.equal(actor.system.inspiration.value,2);assert.equal(item.system.charges.value,1);assert.equal(item.system.quantity,1);assert.deepEqual(m.getFlag('vitruviy','item').targets,[]);assert.equal(m.getFlag('vitruviy','itemEffect'),undefined);assert.deepEqual(dice,[]);assert.deepEqual(prompts,[]);assert.ok(!JSON.stringify(m).includes('PRIVATE'));assert.match(m.content,/vit-inspiration-event/);
});
test('insufficient inspiration prevents activation, publication and all other resource debits',async()=>{
 setup();actor.system.inspiration.value=0;await assert.rejects(rollItem(item),/NotEnoughInspiration/);assert.equal(messages.length,0);assert.equal(item.system.charges.value,2);assert.equal(item.system.quantity,2);assert.deepEqual(dice,[]);
});
test('empty charge pool prevents activation without losing inspiration or quantity',async()=>{
 setup();item.system.charges.value=0;await assert.rejects(rollItem(item),/NotEnoughCharges/);assert.equal(messages.length,0);assert.equal(actor.system.inspiration.value,3);assert.equal(item.system.quantity,2);
});
test('failed chat creation rolls back inspiration, charges and quantity and permits retry',async()=>{
 setup();failChat=true;await assert.rejects(rollItem(item),/offline/);assert.equal(actor.system.inspiration.value,3);assert.equal(item.system.charges.value,2);assert.equal(item.system.quantity,2);failChat=false;await rollItem(item);assert.equal(actor.system.inspiration.value,2);assert.equal(item.system.charges.value,1);assert.equal(messages.length,1);
});
test('roll updates same message ID and preserves activation receipts without spending resources again',async()=>{
 setup();const m=await rollItem(item),id=m.id,receipt=m.getFlag('vitruviy','chargeUse');const r=await rollActionCard(m);assert.equal(m.id,id);assert.equal(messages.length,1);assert.deepEqual(dice,['2d6']);assert.equal(r.critical,true);assert.equal(r.potentialDamage,15);assert.equal(m.getFlag('vitruviy','item').potentialDamage,15);assert.equal(m.getFlag('vitruviy','actionResult'),true);assert.equal(m.getFlag('vitruviy','chargeUse'),receipt);assert.match(m.content,/vit-inspiration-event/);assert.equal(actor.system.inspiration.value,2);assert.equal(item.system.charges.value,1);assert.equal(item.system.quantity,1);assert.equal(actor.system.health.value,12);assert.deepEqual(actor.effects,[]);
});
test('cancelled roll leaves activation and its resources intact; reroll updates same card',async()=>{
 setup();const m=await rollItem(item);answer=null;assert.equal(await rollActionCard(m),null);assert.deepEqual(dice,[]);assert.equal(messages.length,1);assert.equal(actor.system.inspiration.value,2);answer={mode:'normal'};await rollActionCard(m);await rollActionCard(m);assert.equal(messages.length,1);assert.equal(item.system.charges.value,1);
});
test('one refund returns all activation resources within same card and repeat calls return nothing',async()=>{
 setup();const m=await rollItem(item);await rollActionCard(m);await refundActionResources(m);assert.equal(messages.length,1);assert.equal(actor.system.inspiration.value,3);assert.equal(item.system.charges.value,2);assert.equal(item.system.quantity,2);assert.equal(actionResourcesReturned(m,actor),true);assert.equal(m.getFlag('vitruviy','activationRefunded'),true);await refundActionResources(m);assert.equal(actor.system.inspiration.value,3);assert.equal(item.system.quantity,2);await rollActionCard(m);assert.match(m.content,/ActionResourcesReturned/);assert.equal(messages.length,1);
});
test('simultaneous refund clicks return charges and inspiration once',async()=>{
 setup();const m=await rollItem(item);await Promise.all([refundActionResources(m),refundActionResources(m)]);assert.equal(actor.system.inspiration.value,3);assert.equal(item.system.charges.value,2);assert.equal(item.system.quantity,2);
});
test('double click on activation publishes only one card and spends only once',async()=>{
 setup();await Promise.all([rollItem(item),rollItem(item)]);assert.equal(messages.length,1);assert.equal(actor.system.inspiration.value,2);assert.equal(item.system.charges.value,1);
});
test('legacy repeat-refund route cannot bypass once-only activation refund',async()=>{
 setup();const {refundItemChargesNow}=await import('../system/scripts/charges.mjs');const m=await rollItem(item);await refundItemChargesNow(m,{repeat:true});await refundItemChargesNow(m,{repeat:true});assert.equal(item.system.quantity,2);assert.equal(item.system.charges.value,2);await refundActionResources(m);assert.equal(actor.system.inspiration.value,3);assert.equal(item.system.quantity,2);
});
test('configured action modes determine activation costs; no special character behavior runs',async()=>{
 setup();item.system.actionModes=[{id:'melee',name:'Close',behavior:'melee',overrides:{chargesEnabled:false,quantityUsage:'none',inspirationEnabled:false},valueMode:'healing'}];const m=await rollItem(item,{modeId:'melee'});await rollActionCard(m,{fastForward:true});assert.equal(messages.length,1);assert.equal(item.system.charges.value,2);assert.equal(actor.system.inspiration.value,3);assert.equal(m.getFlag('vitruviy','item').valueMode,'healing');assert.deepEqual(actor.effects,[]);
});
test('revoked ownership or removed mode rejects old card actions',async()=>{
 setup();const m=await rollItem(item);item.isOwner=false;await assert.rejects(rollActionCard(m),/NoPermission/);await assert.rejects(refundActionResources(m),/NoPermission/);item.isOwner=true;m.flags.vitruviy.item.modeId='removed';await assert.rejects(rollActionCard(m),/AMmissing/);
});
test('GM assigns targets only after activation; later roll preserves those targets',async()=>{
 setup();const token={name:'Enemy',actor,document:{uuid:'Scene.s.Token.t'}};game.user.targets=new Set([token]);const m=await rollItem(item);assert.equal(prompts.length,0);answer={target0:'on'};await assignActionTargets(m);game.user.targets.clear();answer={mode:'normal'};await rollActionCard(m);assert.equal(m.getFlag('vitruviy','item').targets[0].uuid,token.document.uuid);assert.equal(messages.length,1);
});
test('GM transport computes costs using actual item settings and attributes the card to initiating player',async()=>{
 setup();await processResourceRequest(actor,'activation-one',{kind:'activateItem',payload:{itemId:item.id,visibility:'public',cost:999},time:Date.now()},'p');assert.equal(actor.flags['operationResults.activation-one'].status,'completed');assert.equal(actor.system.inspiration.value,2);assert.equal(item.system.charges.value,1);assert.equal(messages.length,1);assert.equal(messages[0].author.id,'p');assert.equal(messages[0].flags.vitruviy.resource.cost,1);
});
test('explicit effect updates the same card, applies once, and never creates another chat message',async()=>{
 setup();actor.createEmbeddedDocuments=async(_type,data)=>data.map(d=>({...d,id:'effect',getFlag(_s,k){return d.flags.vitruviy[k]}}));item.system.effectEnabled=true;item.system.effectTarget='self';item.system.effectAttribute='combat';item.system.effectBonus=1;const m=await rollItem(item);assert.equal(m.getFlag('vitruviy','itemEffect'),undefined);await applyActionEffect(m);assert.equal(messages.length,1);assert.equal(m.getFlag('vitruviy','itemEffect').attribute,'combat');assert.equal(actor.flags['itemEffectsApplied.'+m.id],true);
});
test('retirement saves generated effect before deletion and keeps manually configured ones',async()=>{
 setup();const generated={id:'old',getFlag:()=>true,toObject:()=>({_id:'old'})},manual={id:'manual',getFlag:()=>false};actor.effects=[generated,manual];actor.deleteEmbeddedDocuments=async(_type,ids)=>{assert.deepEqual(ids,['old']);assert.ok(actor.flags.retiredRedlineEffects.old);actor.effects=[manual];return [generated]};assert.equal(await retireRedlineEffects(actor),1);assert.deepEqual(actor.effects,[manual]);
});
test('Jujutsu header defaults work with existing old header settings',()=>{setup();assert.equal(headerBackground('jujutsu',{starwars:'old.jpg'}),DEFAULT_HEADER_BACKGROUNDS.jujutsu);assert.equal(headerBackground('jujutsu',{jujutsu:''}),'');});
function selfAreaSetup(){
 setup();item.system.areaEnabled=true;item.system.areaPlacement='self';item.system.areaShape='circle';item.system.areaSize=2;
 const created=[],scene={id:'s',uuid:'Scene.s',grid:{size:100,distance:1,units:'m'},async createEmbeddedDocuments(type,data){assert.equal(type,'Region');created.push(...data);return data.map(d=>({...d,uuid:'Scene.s.Region.r',delete:async()=>{created.length=0}}));}};
 const token={uuid:'Scene.s.Token.origin',actor,parent:scene,x:100,y:100,width:1,height:1,rotation:0};lookup.set(token.uuid,token);canvas.scene=scene;canvas.tokens.placeables=[{actor,document:token}];
 const create=ChatMessage.create;ChatMessage.create=async data=>{const m=await create(data);m.delete=async()=>{messages.splice(messages.indexOf(m),1);lookup.delete(m.uuid)};return m;};
 return {scene,created};
}
test('self area is created automatically during activation and never recreated by rerolls',async()=>{
 const {created}=selfAreaSetup();const m=await rollItem(item);assert.equal(created.length,1);assert.equal(created[0].shapes[0].x,150);assert.equal(created[0].shapes[0].y,150);assert.equal(m.getFlag('vitruviy','areaRegionUuid'),'Scene.s.Region.r');assert.deepEqual(dice,[]);assert.equal(prompts.length,0);
 await rollActionCard(m);await rollActionCard(m);assert.equal(created.length,1);assert.equal(messages.length,1);assert.match(m.content,/SelfAreaCreated/);assert.equal(item.system.charges.value,1);
});
test('missing self initiator token fails before spending or publishing',async()=>{
 selfAreaSetup();canvas.tokens.placeables=[];await assert.rejects(rollItem(item),/SelfAreaNeedsToken/);assert.equal(messages.length,0);assert.equal(actor.system.inspiration.value,3);assert.equal(item.system.charges.value,2);
});
test('failed automatic region creation removes declaration and refunds activation resources',async()=>{
 const {scene}=selfAreaSetup();scene.createEmbeddedDocuments=async()=>{throw Error('region denied')};await assert.rejects(rollItem(item),/region denied/);assert.equal(messages.length,0);assert.equal(actor.system.inspiration.value,3);assert.equal(item.system.charges.value,2);assert.equal(item.system.quantity,2);
});
test('manual point area never auto-places on activation',async()=>{
 const {created}=selfAreaSetup();item.system.areaPlacement='point';canvas.tokens.placeables=[];const m=await rollItem(item);assert.equal(created.length,0);assert.equal(m.getFlag('vitruviy','item').area.placement,'point');assert.equal(messages.length,1);
});
