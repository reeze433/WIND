import test from "node:test";
import assert from "node:assert/strict";
import {TIERS, tierModifier, damageForSuccesses} from "../system/scripts/tiers.mjs";
import {rollItem as useItem} from "../system/scripts/items.mjs";
import {canIncreaseInspiration} from "../system/scripts/rolls.mjs";
import {grantInspiration, ensureInspirationMacro} from "../system/scripts/inspiration.mjs";
const rollItem=(item,options={})=>useItem(item,{confirmTargets:false,...options});
const gm={id:"gm",isGM:true}, player={id:"player",isGM:false};
let messages=[], failChat=false, createdMacros=[], promptValue={mode:"normal",rollMode:"gm"};
const actor={id:"hero",uuid:"Actor.hero",name:"Hero",type:"character",isOwner:true,system:{attributes:{combat:4},inspiration:{value:2},health:{value:10}},async update(data){Object.assign(this.system.inspiration,{value:data["system.inspiration.value"]});return this;}};
const actors=[actor]; actors.get=id=>actors.find(a=>a.id===id);
globalThis.game={user:gm,users:Object.assign([gm,player],{activeGM:gm}),actors,macros:[],i18n:{localize:key=>key},settings:{get:()=>"public"}};
globalThis.CONST={DOCUMENT_OWNERSHIP_LEVELS:{NONE:0,OWNER:3}};
globalThis.ui={notifications:{warn:()=>{},info:()=>{}}};
globalThis.foundry={applications:{api:{DialogV2:{prompt:async()=>promptValue}}}};
globalThis.Macro={create:async data=>{createdMacros.push(data); return data;}};
globalThis.Roll=class{constructor(formula){this.formula=formula;this.dice=[];}async evaluate(){this.dice=[{results:[4,4,6,1].map(result=>({result,active:true}))}];return this;}};
globalThis.ChatMessage={getSpeaker:()=>({}),applyMode:(data,mode)=>data.mode=mode,create:async data=>{if(failChat)throw new Error("offline");messages.push(data);return {id:String(messages.length)};}};
const item=()=>({uuid:"Actor.hero.Item.weapon",name:"Sniper <B>",type:"equipment",isOwner:true,actor,system:{privateDescription:"PRIVATE SENTINEL",description:"Public",tier:"B",attribute:"combat",rollEnabled:true,dealsDamage:true}});
test("tier scale exactly matches S5 A4 B3 C2 D1 E0; 4 successes with B yields 12",()=>{
 assert.deepEqual(TIERS,{S:5,A:4,B:3,C:2,D:1,E:0}); assert.equal(damageForSuccesses(4,"B"),12); assert.equal(damageForSuccesses(4,"E"),0);
 assert.throws(()=>tierModifier("F")); assert.throws(()=>damageForSuccesses(-1,"B"));
});



test("inspiration grant API rejects players before dialog; fake refund cannot grant",async()=>{
 game.user=player;await assert.rejects(grantInspiration());assert.equal(canIncreaseInspiration(actor,3),false);assert.equal(canIncreaseInspiration(actor,3,{vitruviyInspirationRefund:true}),false);game.user=gm;
});
test("GM grant chooses an active player character and adds requested amount; cancellation does nothing",async()=>{
 player.active=true;player.character=actor;player.name="Player";
 actor.system.inspiration.value=2;promptValue={userId:"player",amount:"3"};await grantInspiration();assert.equal(actor.system.inspiration.value,5);
 promptValue=null;await grantInspiration();assert.equal(actor.system.inspiration.value,5);
});
test("GM macro is private: default none, only GM explicit owner; player creates none",async()=>{
 createdMacros=[];game.user=player;await ensureInspirationMacro();assert.equal(createdMacros.length,0);
 game.user=gm;await ensureInspirationMacro();assert.deepEqual(createdMacros[0].ownership,{default:0,gm:3});assert.equal(createdMacros[0].type,"script");
});


foundry.applications.ux={TextEditor:{enrichHTML:async text=>text}};


