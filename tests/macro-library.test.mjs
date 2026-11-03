import test from 'node:test';import assert from 'node:assert/strict';
globalThis.foundry={applications:{api:{ApplicationV2:class{},HandlebarsApplicationMixin:base=>base}}};
const {ensureMacroLibrary,macroDefinitions}=await import('../system/scripts/macros.mjs');
test('library adopts legacy inspiration and vision macros; a second startup writes and creates nothing',async()=>{
 let writes=0,creates=0;const gm={id:'gm',isGM:true},users=[gm];users.activeGM=gm;
 const make=(id,flags)=>({id,flags,getFlag(_scope,key){return this.flags.vitruviy?.[key];},async update(data){writes++;Object.assign(this,structuredClone(data));}});
 const legacyGrant=make('grant-old',{vitruviy:{grantInspiration:true}}),legacyVision=make('vision-old',{vitruviy:{fixTokenVision:true}}),macros=[legacyGrant,legacyVision];
 globalThis.game={user:gm,users,macros,i18n:{localize:key=>key},folders:[{id:'folder',type:'Macro',name:'Wind',getFlag:()=>true}]};
 globalThis.Macro={create:async data=>{creates++;const document=make('new'+creates,data.flags);Object.assign(document,structuredClone(data));macros.push(document);return document;}};
 await ensureMacroLibrary();assert.equal(macros.length,macroDefinitions().length);assert.equal(legacyGrant.flags.vitruviy.libraryMacro,'grant');assert.equal(legacyVision.flags.vitruviy.libraryMacro,'vision');
 const firstWrites=writes,firstCreates=creates;await ensureMacroLibrary();assert.equal(writes,firstWrites);assert.equal(creates,firstCreates);
});
