import test from 'node:test';
import assert from 'node:assert/strict';
import {fixTokenVision,configureHealthHover} from '../system/scripts/vision.mjs';
let sceneUpdate, tokenUpdates, actorUpdate, mode, marked=false;
globalThis.game={user:{id:'gm',isGM:true,getFlag:()=>marked,setFlag:async()=>marked=true},modules:new Map([['healthEstimate',{active:true}]]),settings:{set:async(_scope,_key,value)=>mode=value},i18n:{localize:key=>key}};
globalThis.ui={notifications:{warn:()=>{},info:()=>{}}};
globalThis.canvas={tokens:{controlled:[]},scene:{update:async data=>sceneUpdate=data,updateEmbeddedDocuments:async(_type,data)=>tokenUpdates=data}};
test('vision fix needs GM and selected tokens, uses core sight and never changes walls or illumination',async()=>{
 game.user.isGM=false;await assert.rejects(fixTokenVision());game.user.isGM=true;await fixTokenVision();assert.equal(sceneUpdate,undefined);
 canvas.tokens.controlled=[{id:'one',document:{actorLink:true},actor:{update:async data=>actorUpdate=data}}];await fixTokenVision();
 assert.deepEqual(sceneUpdate,{tokenVision:true});assert.deepEqual(tokenUpdates,[{_id:'one','sight.enabled':true,'sight.visionMode':'basic'}]);assert.equal(actorUpdate['prototypeToken.sight.enabled'],true);
});
test('Health Estimate Color Names preference is configured once per user, including players',async()=>{
 game.user.isGM=false;await configureHealthHover();assert.equal(mode,'nameplate');assert.equal(marked,true);
 mode='unchanged';await configureHealthHover();assert.equal(mode,'unchanged');
});
