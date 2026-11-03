import test from 'node:test';import assert from 'node:assert/strict';
import {firstFree,intersects} from '../system/scripts/card-grid.mjs';
import {hubSettingPlan} from '../system/scripts/settings-plan.mjs';
import {setChangedSetting} from '../system/scripts/settings-utils.mjs';
const valid={cardLayout:'grid',healthPerWellbeing:6,criticalOnDoubleSuccess:true,initiativeAttribute:'thinking',movementUnits:'metres',customPanelName:'Скрипты',cardGridOpacity:25,gridWidth:4,ability:32,equipment:64,custom:128,theme:'cyberpunk',fontPreset:'theme'};
test('settings hub validates all sections without changing existing storage keys',()=>{
 const plan=hubSettingPlan(valid);assert.equal(plan.healthPerWellbeing,6);assert.deepEqual(plan.cardCreationDefaults,{gridWidth:4,grids:{ability:32,equipment:64,custom:128}});
 for(const patch of [{healthPerWellbeing:-1},{healthPerWellbeing:2.5},{gridWidth:9},{custom:1000000},{initiativeAttribute:'invalid'},{theme:'invalid'},{cardLayout:'invalid'},{cardGridOpacity:101}])assert.throws(()=>hubSettingPlan({...valid,...patch}),/InvalidCheck/);
 assert.equal(hubSettingPlan({...valid,criticalOnDoubleSuccess:false}).criticalOnDoubleSuccess,false);
});
test('unchanged settings do not fire callbacks or rebuild presentation assets',async()=>{
 let writes=0;const values={cardCreationDefaults:{gridWidth:4,grids:{ability:32,equipment:64,custom:128}}};globalThis.game={settings:{get:(_s,key)=>values[key],set:async(_s,key,value)=>{writes++;values[key]=value;}}};
 assert.equal(await setChangedSetting('cardCreationDefaults',structuredClone(values.cardCreationDefaults)),false);assert.equal(writes,0);
 assert.equal(await setChangedSetting('cardCreationDefaults',{gridWidth:5,grids:{ability:32,equipment:64,custom:128}}),true);assert.equal(writes,1);
});
test('scanline grid placement matches exhaustive row order in 500 randomized layouts',()=>{
 let seed=173;const random=n=>{seed=(seed*1664525+1013904223)>>>0;return seed%n;};
 const brute=(rects,size,columns,limit)=>{for(let y=0;y<=limit-size.h;y++)for(let x=0;x<=columns-size.w;x++)if(!rects.some(rect=>intersects({...size,x,y},rect)))return{x,y};return null;};
 for(let i=0;i<500;i++){const columns=8+random(15),limit=8+random(15),size={w:1+random(5),h:1+random(6)},occupied=Array.from({length:random(45)},()=>({x:random(columns),y:random(limit),w:1+random(5),h:1+random(6)})),expected=brute(occupied,size,columns,limit);if(expected)assert.deepEqual(firstFree(occupied,size,{columns,limit}),expected);else assert.throws(()=>firstFree(occupied,size,{columns,limit}),/Grid full/);}
});
test('large blocked grid jumps directly past occupied bands',()=>{
 const occupied=Array.from({length:500},(_,y)=>({x:0,y,w:512,h:1}));assert.deepEqual(firstFree(occupied,{w:5,h:6},{columns:512,limit:512}),{x:0,y:500});
});

test('grid and list modes use the same persisted limits and do not rewrite character data',()=>{
 const grid=hubSettingPlan({...valid,cardLayout:'grid'}),list=hubSettingPlan({...valid,cardLayout:'list'});assert.equal(list.cardLayout,'list');delete grid.cardLayout;delete list.cardLayout;assert.deepEqual(grid,list);
});
