import test from 'node:test';import assert from 'node:assert/strict';
import {areaSettings,areaPixels,areaShapeData,areaRegionData,createAreaRegion} from '../system/scripts/item-area.mjs';
import {defenseFor,recordDefense} from '../system/scripts/targets.mjs';
import {processResourceRequest} from '../system/scripts/operations.mjs';
import {chooseAndRollInitiative,macroDefinitions} from '../system/scripts/macros.mjs';
import {hubSettingPlan} from '../system/scripts/settings-plan.mjs';
let actor,attack,messages,gm,player,settings;
function setup(){
 gm={id:'gm',isGM:true};player={id:'p',isGM:false};const users=[gm,player];users.activeGM=gm;users.get=id=>users.find(entry=>entry.id===id);settings={initiativeAttribute:'combat',responseRollVisibility:'gm'};messages=[];
 globalThis.game={user:gm,users,messages,settings:{get:(_s,key)=>settings[key]},i18n:{localize:key=>key}};
 globalThis.ui={notifications:{warn:()=>{},info:()=>{},error:()=>{}}};
 actor={uuid:'Actor.a',isOwner:true,system:{attributes:{combat:3,thinking:2}},flags:{},testUserPermission:()=>true,getFlag(_s,key){return this.flags[key];},async update(data){for(const [key,value]of Object.entries(data))if(key.startsWith('flags.vitruviy.'))this.flags[key.slice(15)]=value;return this;}};
 attack={id:'attack',uuid:'ChatMessage.attack',visible:true,getFlag:(_s,key)=>key==='item'?{dealsDamage:true,targets:[{uuid:'Scene.s.Token.a'}]}:key==='check'?{total:1}:null,async update(){return this;}};
 globalThis.fromUuid=async uuid=>uuid===attack.uuid?attack:uuid==='Scene.s.Token.a'?{actor}:null;
 globalThis.ChatMessage={getSpeaker:()=>({}),create:async data=>{const entry={...data,id:'r'+messages.length,visible:true,getFlag:(_s,key)=>data.flags?.vitruviy?.[key]};messages.push(entry);return entry;}};
 globalThis.Roll=class{constructor(){this.dice=[];}async evaluate(){this.dice=[{results:[{result:4},{result:4},{result:1}]}];return this;}};
 globalThis.foundry={applications:{api:{DialogV2:{prompt:async()=>null}}}};
}
test('areas have exact metric/feet scale and independent radius, length, width and cone angle',()=>{
 setup();const metres={grid:{size:100,distance:1,units:'m'}},feet={grid:{size:100,distance:5,units:'ft'}};
 assert.equal(areaSettings({areaEnabled:false}),null);assert.equal(areaPixels(metres),100);assert.ok(Math.abs(areaPixels(feet)-65.6167979)<1e-6);
 const area={shape:'circle',size:3,width:2,angle:90};assert.equal(areaShapeData(area,metres,{x:10,y:20}).radius,300);
 const cone=areaShapeData({...area,shape:'cone'},metres,{x:1,y:2},45);assert.equal(cone.radius,300);assert.equal(cone.angle,90);assert.equal(cone.rotation,45);
 const line=areaShapeData({...area,shape:'line'},feet,{x:1,y:2});assert.ok(Math.abs(line.length-196.8503937)<1e-6);assert.ok(Math.abs(line.width-131.2335958)<1e-6);
 const rect=areaShapeData({...area,shape:'rectangle'},metres,{x:1,y:2},90);assert.equal(rect.width,300);assert.equal(rect.height,200);assert.equal(rect.anchorY,.5);
 const data=areaRegionData(area,metres,{x:0,y:0},0,{userId:'p',messageUuid:attack.uuid});assert.equal(data.visibility,2);assert.equal(data.ownership.p,3);assert.equal(data.restriction.enabled,false);
});
test('invalid areas cannot create unbounded geometry or silently guess unknown scene units',()=>{
 setup();for(const patch of [{areaShape:'unknown'},{areaSize:-1},{areaSize:Infinity},{areaSize:1001},{areaAngle:0},{areaWidth:NaN}])assert.throws(()=>areaSettings({areaEnabled:true,...patch}));
 assert.throws(()=>areaPixels({grid:{size:100,distance:1,units:'miles'}}),/AreaUnitsUnknown/);assert.throws(()=>areaPixels({grid:{size:100,distance:0,units:'m'}}));
});
test('GM can place a player-owned area on the player viewed scene without widening creation permissions',async()=>{
 setup();player.viewedScene='s';let writes=0;
 const scene={id:'s',grid:{size:100,distance:1,units:'m'},testUserPermission:()=>false,createEmbeddedDocuments:async(type,data)=>{assert.equal(type,'Region');writes++;return data;}};
 const item={actor};globalThis.fromUuid=async uuid=>uuid==='Actor.a.Item.i'?item:null;
 const message={uuid:'ChatMessage.area',author:player,getFlag:()=>({uuid:'Actor.a.Item.i',name:'Area',area:{shape:'circle',size:2,width:1,angle:90}})};
 const region=await createAreaRegion(actor,message,scene,{point:{x:10,y:20},direction:0},player);assert.equal(region.ownership.p,3);assert.equal(writes,1);
 player.viewedScene='other';await assert.rejects(createAreaRegion(actor,message,scene,{point:{x:10,y:20},direction:0},player),/NoPermission/);
 player.viewedScene='s';await assert.rejects(createAreaRegion({...actor,uuid:'Actor.other'},message,scene,{point:{x:10,y:20},direction:0},player),/NoPermission/);assert.equal(writes,1);
});
test('private responses store no numbers in actor flags, whisper dice only to GMs, allow repeated replies',async()=>{
 setup();const result={attribute:'combat',total:2,mode:'normal',attempts:[{faces:[4,4],symbols:[1,1]}],selected:0};
 await recordDefense(actor,attack,result,player,[]);assert.deepEqual(actor.getFlag('vitruviy','defenses.attack'),{hidden:true});assert.deepEqual(messages[0].whisper,['gm']);assert.equal(messages[0].blind,true);assert.equal(messages[0].author,'gm');
 assert.equal(defenseFor(actor,attack).total,2);game.user=player;assert.deepEqual(defenseFor(actor,attack),{hidden:true});game.user=gm;await recordDefense(actor,attack,{...result,total:9});assert.equal(messages.length,2);assert.equal(defenseFor(actor,attack).total,9);
});
test('private response request rolls on GM and ignores forged client result, unauthorized user is rejected',async()=>{
 setup();await processResourceRequest(actor,'private-a',{kind:'defend',time:Date.now(),payload:{messageUuid:attack.uuid,attribute:'combat',mode:'normal',result:{total:999,attribute:'combat'}}},'p');
 assert.equal(defenseFor(actor,attack).total,2);assert.ok(!JSON.stringify(actor.flags).includes('999'));assert.equal(messages.length,1);
 actor.testUserPermission=()=>false;await processResourceRequest(actor,'private-b',{kind:'defend',time:Date.now(),payload:{}},'p');assert.equal(actor.getFlag('vitruviy','operationResults.private-b'),undefined);
});
test('public response remains public with normal actor state and failed chat writes do not mark a response',async()=>{
 setup();settings.responseRollVisibility='public';const result={attribute:'combat',total:2,mode:'normal',attempts:[],selected:0};await recordDefense(actor,attack,result,player,[]);assert.deepEqual(actor.getFlag('vitruviy','defenses.attack'),{total:2,attribute:'combat'});assert.deepEqual(messages[0].whisper,[]);
 actor.flags={};ChatMessage.create=async()=>null;await assert.rejects(recordDefense(actor,attack,result,player,[]),/UpdateCancelled/);assert.equal(actor.getFlag('vitruviy','defenses.attack'),undefined);
});
test('initiative choice rolls only missing participants using one-off attribute and cancel changes nothing',async()=>{
 setup();const calls=[];game.combats={viewed:{combatants:[{id:'a',initiative:null},{id:'b',initiative:0}],rollInitiative:async(ids,options)=>calls.push({ids,options})}};
 foundry.applications.api.DialogV2.prompt=async()=> 'thinking';await chooseAndRollInitiative();assert.deepEqual(calls,[{ids:['a'],options:{attribute:'thinking'}}]);assert.equal(settings.initiativeAttribute,'combat');
 foundry.applications.api.DialogV2.prompt=async()=>null;await chooseAndRollInitiative();assert.equal(calls.length,1);
 const definitions=macroDefinitions();assert.ok(definitions.find(entry=>entry.id==='initiative'));assert.ok(definitions.find(entry=>entry.id==='roll-initiative-choose'));assert.ok(!definitions.find(entry=>entry.id==='combat-initiative'));
});
test('hub saves custom inspiration templates from native flat form names as well as nested objects',()=>{
 setup();const valid={cardLayout:'grid',healthPerWellbeing:6,initiativeAttribute:'combat',movementUnits:'metres',gridWidth:3,ability:32,equipment:32,custom:32,cardGridOpacity:25,theme:'standard',fontPreset:'theme',responseRollVisibility:'gm','inspirationMessages.gain':'{Игрок} +{Количество}','inspirationMessages.spend':'Трата {Количество}','inspirationMessages.edit':'{Было} => {Стало}'};
 const plan=hubSettingPlan(valid);assert.equal(plan.inspirationMessages.gain,'{Игрок} +{Количество}');assert.equal(plan.responseRollVisibility,'gm');assert.throws(()=>hubSettingPlan({...valid,responseRollVisibility:'fake'}));
});
