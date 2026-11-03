import test from 'node:test';import assert from 'node:assert/strict';
class ItemBase{async _preCreate(){return this.allowed;}updateSource(update){this.update=update;}static migrateData(data){return data;}}
globalThis.foundry={documents:{Item:ItemBase},applications:{api:{ApplicationV2:class{},HandlebarsApplicationMixin:base=>base}}};
const {UniversalItem}=await import('../system/scripts/item-document.mjs');
const {panelOrder}=await import('../system/scripts/card-defaults.mjs');
test('new cards receive world default, explicit sizes on imported or copied cards survive',async()=>{
 globalThis.game={settings:{get:()=>({gridWidth:5})}};
 const fresh=new UniversalItem();await fresh._preCreate({type:'card',system:{}},{},{});assert.deepEqual(fresh.update,{'system.gridWidth':5});
 for(const width of [3,4,5]){const copy=new UniversalItem();await copy._preCreate({system:{gridWidth:width}},{},{});assert.equal(copy.update,undefined);}
 const denied=new UniversalItem();denied.allowed=false;assert.equal(await denied._preCreate({system:{}},{},{}),false);assert.equal(denied.update,undefined);
});
test('panel order accepts custom first, restores missing panels and ignores malformed values',()=>{
 assert.deepEqual(panelOrder(['custom','ability','equipment']),['custom','ability','equipment']);
 assert.deepEqual(panelOrder(['custom','custom','bad']),['custom','ability','equipment']);assert.deepEqual(panelOrder(null),['ability','equipment','custom']);
});

test('card defaults settings reject unauthorized and invalid changes; save independent valid limits',async()=>{
 const {CardDefaultsSettings}=await import('../system/scripts/card-defaults-settings.mjs');let saved;
 globalThis.game={user:{isGM:false},i18n:{localize:key=>key},settings:{set:async(_namespace,key,value)=>{saved={key,value};}}};
 const form={object:{gridWidth:4,ability:32,equipment:128,custom:512}};
 await assert.rejects(CardDefaultsSettings.save(null,null,form),/NoPermission/);assert.equal(saved,undefined);
 game.user.isGM=true;await assert.rejects(CardDefaultsSettings.save(null,null,{object:{...form.object,custom:999999}}),/InvalidCheck/);assert.equal(saved,undefined);
 await CardDefaultsSettings.save(null,null,form);assert.deepEqual(saved,{key:'cardCreationDefaults',value:{gridWidth:4,grids:{ability:32,equipment:128,custom:512}}});
});
