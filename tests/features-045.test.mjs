import test from 'node:test';import assert from 'node:assert/strict';
import {customResourceState} from '../system/scripts/resource-state.mjs';
import {chargePlan,withItemCharges,refundItemCharges} from '../system/scripts/charges.mjs';
import {writeResourceValues} from '../system/scripts/resource-values.mjs';
import {attributePool} from '../system/scripts/branches.mjs';
import {restoreActor} from '../system/scripts/rest.mjs';
import {confirmItemTargets,targetCandidates,recordDefense} from '../system/scripts/targets.mjs';
import {effectData,prepareItemEffect,applyItemEffect} from '../system/scripts/item-effects.mjs';
import {movementBand,movementBudget,installMovementRuler} from '../system/scripts/movement-budget.mjs';
import {registerPlayerDice,playerDiceSystem} from '../system/scripts/player-dice.mjs';
import {prepareDiceRoll} from '../system/scripts/dice3d.mjs';
import {macroDefinitions,setInitiativeAttribute} from '../system/scripts/macros.mjs';
import {branchExamples} from '../system/scripts/examples.mjs';
import {checkedUpdate,checkedEmbeddedUpdate} from '../system/scripts/document-writes.mjs';
let actor,deck,child,messages;
function setup(){
 const gm={id:'gm',isGM:true},player={id:'p',isGM:false},users=[gm,player];users.activeGM=gm;users.get=id=>users.find(user=>user.id===id);
 const settings={customResourceCount:1,customResourceNames:['Память деки'],movementTable:[0,8,10,12,13,14,15],movementBudgetEnabled:true};
 globalThis.game={user:gm,users,settings:{get:(_scope,key)=>settings[key],set:async(_scope,key,value)=>{settings[key]=value;}},i18n:{localize:key=>key},modules:new Map([['dice-so-nice',{active:true}]])};
 globalThis.ui={notifications:{error:()=>{},warn:()=>{},info:()=>{}}};messages=[];
 globalThis.ChatMessage={getSpeaker:()=>({}),create:async message=>{messages.push(message);return message;}};
 globalThis.canvas={tokens:{controlled:[]},grid:{units:'m'}};
 actor={id:'a',uuid:'Actor.a',name:'Actor',isOwner:true,flags:{},items:new Map(),effects:[],system:{attributes:{movement:1,combat:3,thinking:4},health:{value:2,max:18},inspiration:{value:7},currencies:{money:100},customResources:{r0:{value:99,maximumMode:'item',maximumItemId:'deck',recoveryMode:'round',recovery:'2'}}},getFlag(_scope,key){return this.flags[key];},
 async update(changes){for(const [key,value] of Object.entries(changes)){if(key.startsWith('flags.vitruviy.'))this.flags[key.slice(15)]=value;else{const parts=key.split('.');let entry=this;for(const part of parts.slice(0,-1))entry=entry[part]??={};entry[parts.at(-1)]=value;}}return this;},
 async updateEmbeddedDocuments(type,updates){assert.equal(type,'Item');for(const update of updates){const item=this.items.get(update._id);for(const [key,value] of Object.entries(update)){if(key.startsWith('flags.vitruviy.'))item.flags[key.slice(15)]=value;else if(key==='system.charges.value')item.system.charges.value=value;}}return updates.map(update=>this.items.get(update._id));}};
 deck={id:'deck',uuid:'Actor.a.Item.deck',actor,isOwner:true,name:'Дека',flags:{},system:{chargesEnabled:true,charges:{value:6,max:12},chargeCost:1,quantity:1,restRecovery:false},getFlag(_scope,key){return this.flags[key];}};
 child={id:'child',actor,isOwner:true,name:'Программа',flags:{},system:{customResourceId:'r0',customResourceCost:2,quantity:1},getFlag(_scope,key){return this.flags[key];}};
 actor.items.set(deck.id,deck);actor.items.set(child.id,child);
 game.actors=[actor];globalThis.fromUuid=async uuid=>uuid===actor.uuid?actor:null;
 return settings;
}
test('item-bound resource is the same pool: read, manual edit, item change, spend and one-time refund',async()=>{
 setup();const state=()=>customResourceState(actor,{id:'r0'});
 assert.equal(state().value,6);assert.equal(state().maximum,12);
 await writeResourceValues(actor,[{state:state(),value:8}]);assert.equal(deck.system.charges.value,8);
 deck.system.charges.value=5;assert.equal(state().value,5);
 const receipt=await withItemCharges(child,async(uses,useId,quantity,customResource)=>({actorUuid:actor.uuid,uses,useId,quantity,customResource}));
 assert.equal(deck.system.charges.value,3);assert.equal(state().value,3);assert.equal(receipt.uses.length,1);
 const message={visible:true,getFlag:(_scope,key)=>key==='chargeUse'?receipt:null};
 await refundItemCharges(message);await refundItemCharges(message);assert.equal(deck.system.charges.value,5);
});
test('same pool own/source/counter costs merge without overwriting each other; chat failure rolls back',async()=>{
 setup();child.system.chargeSourceId='deck';child.system.sourceChargeCost=1;
 assert.equal(chargePlan(child)[0].cost,3);
 await assert.rejects(withItemCharges(child,async()=>{throw Error('offline');}),/offline/);
 assert.equal(deck.system.charges.value,6);
 deck.system.charges.value=2;assert.throws(()=>chargePlan(child),/NotEnoughCharges/);
});
test('rest restores HP, marked pools and counters, preserves currency/quantity, adds inspiration or adds nothing at zero',async()=>{
 setup();child.system.chargesEnabled=true;child.system.charges={value:1,max:3};child.system.restRecovery=true;child.system.quantity=5;
 await restoreActor(actor,0,'rest-a');assert.equal(actor.system.health.value,18);assert.equal(actor.system.inspiration.value,7);assert.equal(deck.system.charges.value,6);assert.equal(child.system.charges.value,3);assert.equal(child.system.quantity,5);assert.equal(actor.system.currencies.money,100);
 deck.system.restRecovery=true;await restoreActor(actor,1,'rest-b');assert.equal(deck.system.charges.value,12);assert.equal(actor.system.inspiration.value,8);
 await restoreActor(actor,1,'rest-b');assert.equal(actor.system.inspiration.value,8);
});
test('attack and defense default to the attribute, bonuses affect only their branch and disappear when removed',()=>{
 setup();assert.equal(attributePool(actor,'combat','attack'),3);assert.equal(attributePool(actor,'combat','defense'),3);
 actor.system.defenseBonuses={combat:1};assert.equal(attributePool(actor,'combat','defense'),4);assert.equal(attributePool(actor,'combat','attack'),3);assert.equal(actor.system.attributes.combat,3);
 actor.system.defenseBonuses.combat=0;assert.equal(attributePool(actor,'combat','defense'),3);
 const examples=branchExamples();assert.equal(examples.length,2);
 assert.equal(effectData({attribute:'combat',bonus:1,branch:'defense'},'m').system.changes[0].key,'system.defenseBonuses.combat');
 assert.equal(effectData({attribute:'thinking',bonus:1,branch:'attack'},'m').system.changes[0].key,'system.attackBonuses.thinking');
});
test('initiative has six direct GM macros and a selector; setting a different attribute preserves already rolled initiatives',async()=>{
 setup();assert.equal(macroDefinitions().filter(macro=>macro.id.startsWith('initiative-')&&macro.id!=='initiative-choose').length,6);
 await setInitiativeAttribute('wellbeing');assert.equal(game.settings.get('vitruviy','initiativeAttribute'),'wellbeing');
 game.user.isGM=false;await assert.rejects(setInitiativeAttribute('movement'),/NoPermission/);
});
test('target confirmation offers both selected and targeted tokens, supports multiple and freezes their identities',async()=>{
 setup();const token=name=>({name,document:{uuid:`Scene.s.Token.${name}`},actor:{uuid:`Actor.${name}`}}),a=token('a'),b=token('b'),source=token('source');
 game.user.targets=new Set([a,b]);canvas.tokens.controlled=[source,b];
 assert.equal(targetCandidates(child).tokens.length,3);
 let content;globalThis.foundry={applications:{api:{DialogV2:{prompt:async options=>{content=options.content;game.user.targets.clear();return {target0:'on',target1:'on'};}}}}};
 const chosen=await confirmItemTargets(child);assert.deepEqual(chosen.map(token=>token.name),['a','b']);assert.match(content,/VIT.Targeted/);assert.match(content,/VIT.Selected/);
 foundry.applications.api.DialogV2.prompt=async()=>null;assert.equal(await confirmItemTargets(child),null);
});
test('a buff can prepare multiple targets while choosing one attribute for the action',async()=>{
 setup();child.uuid='Actor.a.Item.child';child.system={effectEnabled:true,effectTarget:'target',effectAttribute:'combat',effectBonus:1,effectBranch:'defense'};
 const targets=[{actor:{uuid:'Actor.b',isOwner:true}},{actor:{uuid:'Actor.c',isOwner:true}}];
 const effect=await prepareItemEffect(child,targets);assert.deepEqual(effect.targetUuids,['Actor.b','Actor.c']);assert.equal(effect.branch,'defense');
});
test('response records repeated selected attributes and rejects a character absent from the action targets',async()=>{
 setup();const token={actor};globalThis.fromUuid=async uuid=>uuid==='Scene.s.Token.a'?token:null;
 const message={id:'m',getFlag:()=>({targets:[{uuid:'Scene.s.Token.a'}]}),update:async()=>message};
 const result={attribute:'movement',total:2,mode:'normal',attempts:[{symbols:[1,1],faces:[4,5]}],selected:0};
 await recordDefense(actor,message,result);await recordDefense(actor,message,{...result,total:9});assert.equal(actor.getFlag('vitruviy','defenses.m').total,9);assert.equal(messages.length,2);
 await assert.rejects(recordDefense({...actor,uuid:'Actor.other'},message,result),/NoPermission/);
});
test('movement uses each token attribute, includes running x2, exact boundaries, custom tables and feet conversion',()=>{
 setup();assert.equal(movementBudget(actor),8);assert.equal(movementBand(8,8),'normal');assert.equal(movementBand(8.1,8),'run');assert.equal(movementBand(16,8),'run');assert.equal(movementBand(16.1,8),'over');
 actor.system.attributes.movement=2;assert.equal(movementBudget(actor),10);assert.equal(movementBand(9,movementBudget(actor)),'normal');
 assert.ok(Math.abs(movementBudget(actor,'ft')-10/.3048)<1e-8);assert.equal(movementBudget(actor,'m',[0,5,7,9,11,13,15]),7);
});
test('native ruler preserves hidden highlights and paints using its own token rather than the selected token',()=>{
 setup();globalThis.CONFIG={Token:{rulerClass:class{_getGridHighlightStyle(){return {alpha:0};}_getSegmentStyle(){return {width:4};}_getWaypointStyle(){return {radius:6};}_shouldRenderWaypoint(){return false;}}}};
 installMovementRuler();const ruler=new CONFIG.Token.rulerClass();ruler.token={actor,document:{actor}};
 const waypoint={measurement:{cost:9},previous:{measurement:{cost:8}}};assert.equal(ruler._getGridHighlightStyle(waypoint,{}).alpha,0);assert.equal(ruler._getSegmentStyle(waypoint).color,0xffa52b);assert.equal(ruler._shouldRenderWaypoint(waypoint),true);
 actor.system.attributes.movement=2;assert.equal(ruler._getSegmentStyle(waypoint).color,0x35ab64);
 canvas.scene={grid:{units:'ft'}};assert.equal(ruler._getSegmentStyle({measurement:{cost:20}}).color,0x35ab64);
});
test('per-user dice presets are shared registrations with different IDs and persisted roll appearances',async()=>{
 const settings=setup();settings.playerDice={p:{style:'red',faces:[]},gm:{style:'numeric',faces:[]}};const presets=[];
 await registerPlayerDice({addSystem:()=>{},addDicePreset:preset=>presets.push(preset)});
 assert.notEqual(playerDiceSystem('p'),playerDiceSystem('gm'));assert.equal(presets.length,2);
 game.user=game.users.get('p');const roll={dice:[{options:{}}]};prepareDiceRoll(roll);assert.equal(roll.dice[0].options.appearance.system,playerDiceSystem('p'));
});
test('native no-op updates are successful, while a cancelled change with a different value remains an error',async()=>{
 setup();const write=actor.updateEmbeddedDocuments.bind(actor);let writes=0;
 actor.updateEmbeddedDocuments=async(type,updates)=>{writes++;const changed=updates.filter(update=>actor.items.get(update._id).system.charges.value!==update['system.charges.value']);return changed.length?write(type,changed):[];};
 await checkedEmbeddedUpdate(actor,'Item',[{_id:deck.id,'system.charges.value':6}]);assert.equal(writes,0);
 await checkedUpdate(actor,{'system.health.value':2});
 actor.update=async()=>undefined;await assert.rejects(checkedUpdate(actor,{'system.health.value':3}),/UpdateCancelled/);
 deck.system.restRecovery=true;await restoreActor({...actor,update:async changes=>{if('system.inspiration.value' in changes)actor.system.inspiration.value=changes['system.inspiration.value'];return actor;}},0,'noop-a');
 await restoreActor({...actor,update:async changes=>{if('system.inspiration.value' in changes)actor.system.inspiration.value=changes['system.inspiration.value'];return actor;}},1,'noop-b');
 assert.equal(actor.system.inspiration.value,8);
});

test('bound pool recovers once per round, including a retry after the actor ledger fails',async()=>{
 setup();globalThis.foundry={applications:{api:{ApplicationV2:class{},HandlebarsApplicationMixin:base=>base}}};
 const {recoverCustomResources}=await import('../system/scripts/custom-resources.mjs');
 const combat={id:'qa',round:1,combatants:[{actor},{actor}],combatant:{actor,id:'turn'}};
 await recoverCustomResources(combat,{round:1});assert.equal(deck.system.charges.value,8);
 await recoverCustomResources(combat,{round:1});assert.equal(deck.system.charges.value,8);
 actor.update=async()=>{throw Error('ledger failure');};combat.round=2;
 await assert.rejects(recoverCustomResources(combat,{round:2}),/ledger failure/);assert.equal(deck.system.charges.value,10);
 await recoverCustomResources(combat,{round:2});assert.equal(deck.system.charges.value,10);
});
