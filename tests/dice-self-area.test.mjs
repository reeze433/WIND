import test from 'node:test';import assert from 'node:assert/strict';
import {updateActionRoll} from '../system/scripts/action-dice.mjs';
import {areaSettings,selfAreaTokenUuid,validateSelfArea,createActivationArea,areaRegionData} from '../system/scripts/item-area.mjs';
import {normalizeActionMode,effectiveModeItem} from '../system/scripts/item-modes.mjs';
function setup(){globalThis.game={user:{id:'gm',isGM:true},i18n:{localize:k=>k}};globalThis.ui={notifications:{error:()=>{}}};}
function chat(){return {id:'same',uuid:'ChatMessage.same',rolls:[],whisper:[],blind:false,content:'<article></article>',updates:[],deltas:[],flags:{vitruviy:{}},getFlag(_s,k){return this.flags.vitruviy[k]},async update(data){this.updates.push(data);if(data.rolls)this.deltas.push(data.rolls.length-this.rolls.length);for(const[k,v]of Object.entries(data)){if(k.startsWith('flags.vitruviy.'))this.flags.vitruviy[k.slice(15)]=v;else this[k]=v;}return this;}};}
test('same-card rerolls add native rolls for DsN even after changing advantage to normal',async()=>{
 setup();const m=chat(),a={id:'a'},b={id:'b'},c={id:'c'};
 await updateActionRoll(m,{rolls:[a,b],whisper:[],blind:false,content:'first'});await updateActionRoll(m,{rolls:[c],whisper:[],blind:false,content:'second'});
 assert.deepEqual(m.deltas,[2,1]);assert.deepEqual(m.rolls,[a,b,c]);assert.equal(m.id,'same');assert.equal(m.content,'second');
});
test('changing hidden audience to public drops old hidden dice before animating new public ones',async()=>{
 setup();const m=chat();await updateActionRoll(m,{rolls:[{secret:'private'}],whisper:['gm'],blind:true,content:'secret'});
 await updateActionRoll(m,{rolls:[{public:'new'}],whisper:[],blind:false,content:'public'});
 assert.deepEqual(m.deltas,[1,-1,1]);assert.deepEqual(m.rolls,[{public:'new'}]);assert.ok(!JSON.stringify(m.rolls).includes('secret'));assert.equal(m.id,'same');
});
test('whisper order does not trigger a reset, but changing recipient set does',async()=>{
 setup();const m=chat();await updateActionRoll(m,{rolls:[1],whisper:['a','b'],blind:false});await updateActionRoll(m,{rolls:[2],whisper:['b','a'],blind:false});assert.deepEqual(m.rolls,[1,2]);
 await updateActionRoll(m,{rolls:[3],whisper:['a'],blind:false});assert.deepEqual(m.rolls,[3]);assert.deepEqual(m.deltas,[1,1,-2,1]);
});
test('self and point area modes validate and old cards default to manual point placement',()=>{
 setup();assert.equal(areaSettings({areaEnabled:true}).placement,'point');assert.equal(areaSettings({areaEnabled:true,areaPlacement:'self'}).placement,'self');assert.throws(()=>areaSettings({areaEnabled:true,areaPlacement:'other'}));
});
function world(){
 setup();const actor={uuid:'Actor.a',isOwner:true},scene={id:'s',uuid:'Scene.s',grid:{size:100,distance:1,units:'m'}};
 const token={uuid:'Scene.s.Token.t',actor,parent:scene,x:100,y:200,width:2,height:1,rotation:45};
 globalThis.canvas={scene,tokens:{controlled:[],placeables:[{actor,document:token}]}};globalThis.fromUuid=async uuid=>uuid===token.uuid?token:uuid==='Actor.a.Item.i'?{actor}:null;
 return {actor,scene,token};
}
test('self placement uses the initiating actor token center and rotation, never an enemy target',async()=>{
 const {actor,scene,token}=world();canvas.tokens.controlled=[{actor:{uuid:'Actor.enemy'},document:{uuid:'enemy'}}];const id=selfAreaTokenUuid(actor);assert.equal(id,token.uuid);
 const actual=await validateSelfArea(actor,id,{id:'p',viewedScene:'s'});assert.equal(actual.scene,scene);assert.deepEqual(actual.point,{x:200,y:250});assert.equal(actual.direction,45);
});
test('unlinked actor uses its source token; duplicate own tokens need a unique selected initiator',()=>{
 const {actor,token}=world();actor.token=token;assert.equal(selfAreaTokenUuid(actor),token.uuid);delete actor.token;
 canvas.tokens.placeables.push({actor,document:{uuid:'other'}});assert.throws(()=>selfAreaTokenUuid(actor),/SelfAreaChooseToken/);
 canvas.tokens.controlled=[canvas.tokens.placeables[1]];assert.equal(selfAreaTokenUuid(actor),'other');canvas.tokens.controlled=[...canvas.tokens.placeables];assert.throws(()=>selfAreaTokenUuid(actor),/SelfAreaChooseToken/);
});
test('missing, foreign and off-scene self origins fail without creating geometry',async()=>{
 const {actor,token}=world();canvas.tokens.placeables=[];assert.throws(()=>selfAreaTokenUuid(actor),/SelfAreaNeedsToken/);
 await assert.rejects(validateSelfArea({uuid:'Actor.foreign'},token.uuid),/SelfAreaNeedsToken/);await assert.rejects(validateSelfArea(actor,token.uuid,{id:'p',viewedScene:'different'}),/SelfAreaNeedsToken/);
});
test('self rectangle centers on initiator while cone and line start from its center',()=>{
 const {scene}=world(),area={shape:'rectangle',size:3,width:2,angle:90,placement:'self'};const data=areaRegionData(area,scene,{x:200,y:250},45,{userId:'gm'});assert.equal(data.shapes[0].anchorX,.5);assert.equal(data.shapes[0].anchorY,.5);assert.equal(data.shapes[0].x,200);
 const manual=areaRegionData({...area,placement:'point'},scene,{x:0,y:0},0,{userId:'gm'});assert.equal(manual.shapes[0].anchorX,0);
});
test('self area creates one region and adds its receipt to same message',async()=>{
 const {actor,scene,token}=world();let count=0;scene.createEmbeddedDocuments=async(type,data)=>{assert.equal(type,'Region');count++;return data.map(d=>({...d,uuid:'Scene.s.Region.r',delete:async()=>{}}));};
 const m=chat();m.flags.vitruviy.item={uuid:'Actor.a.Item.i',name:'Area',area:{shape:'circle',size:2,width:1,angle:90,placement:'self'}};m.author=game.user;
 await createActivationArea(actor,m,token.uuid);assert.equal(count,1);assert.equal(m.getFlag('vitruviy','areaRegionUuid'),'Scene.s.Region.r');assert.match(m.content,/SelfAreaCreated/);assert.equal(m.id,'same');
});
test('failed receipt update removes newly created self region',async()=>{
 const {actor,scene,token}=world();let removed=0;scene.createEmbeddedDocuments=async()=>[{uuid:'Scene.s.Region.r',delete:async()=>removed++}];const m=chat();m.flags.vitruviy.item={uuid:'Actor.a.Item.i',name:'Area',area:{shape:'circle',size:2,width:1,angle:90,placement:'self'}};m.author=game.user;m.update=async()=>undefined;
 await assert.rejects(createActivationArea(actor,m,token.uuid),/UpdateCancelled/);assert.equal(removed,1);
});
test('action modes can override area placement without mutating base item',()=>{
 setup();const mode=normalizeActionMode({id:'self',name:'Self',overrides:{areaPlacement:'self'}}),item={name:'Item',system:{areaPlacement:'point',actionModes:[mode]}};assert.equal(effectiveModeItem(item,'self').system.areaPlacement,'self');assert.equal(item.system.areaPlacement,'point');assert.throws(()=>normalizeActionMode({...mode,overrides:{areaPlacement:'bad'}}));
});
test('switching to default public mode explicitly clears old whisper and blind fields',async()=>{
 setup();const m=chat();m.rolls=[{secret:true}];m.whisper=['gm'];m.blind=true;await updateActionRoll(m,{rolls:[{current:true}],content:'public'});assert.deepEqual(m.whisper,[]);assert.equal(m.blind,false);assert.deepEqual(m.rolls,[{current:true}]);assert.deepEqual(m.deltas,[-1,1]);
});
