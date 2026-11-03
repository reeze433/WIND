import test from 'node:test';import assert from 'node:assert/strict';import {upgradeHudLayout} from './fixtures/hud-layout-020.mjs';
test('old HUD layout gains custom scripts while preserving personal group settings and order',()=>{
 const original={ability:{id:'ability',name:'Способности',listName:'Способности',level:1,order:1,selected:true},ability_actions:{id:'ability',name:'Способности',level:2,order:1,type:'system'},equipment:{id:'equipment',name:'Инвентарь',level:1,order:2,settings:{showTitle:false}}};
 const upgraded=upgradeHudLayout(original,'Скрипты');assert.equal(upgraded.custom.name,'Скрипты');assert.equal(upgraded.custom.order,2);assert.equal(upgraded.custom_actions.type,'system');assert.equal(upgraded.equipment.order,3);assert.deepEqual(upgraded.equipment.settings,{showTitle:false});assert.equal(upgraded.ability.name,'Особенности');assert.equal(original.ability.name,'Способности');assert.deepEqual(upgradeHudLayout(upgraded,'Скрипты'),upgraded);
});
