import test from 'node:test';import assert from 'node:assert/strict';
import {snapAreaPoint} from '../system/scripts/item-area.mjs';
import {syncZeroHealth} from '../system/scripts/conditions.mjs';
import {pngFiles} from '../system/scripts/random-tile.mjs';
test('area preview snaps using Foundry grid modes and gridless preserves position',()=>{
 globalThis.CONST={GRID_SNAPPING_MODES:{CENTER:1,VERTEX:2,EDGE_MIDPOINT:4}};
 globalThis.canvas={grid:{getSnappedPoint(point,options){assert.deepEqual(options,{mode:7,resolution:1});return {x:100,y:200};}}};
 assert.deepEqual(snapAreaPoint({x:93,y:201}),{x:100,y:200});canvas.grid.isGridless=true;assert.deepEqual(snapAreaPoint({x:93,y:201}),{x:93,y:201});
});
test('zero HP adds skull overlay and healing clears only automatic death',async()=>{
 let flag=false;const calls=[];const actor={uuid:'Actor.zero',isOwner:true,statuses:new Set(),effects:[],system:{health:{value:0}},getFlag:()=>flag,setFlag:async()=>{flag=true;},unsetFlag:async()=>{flag=false;},toggleStatusEffect:async(id,options)=>{calls.push([id,options]);if(options.active)actor.statuses.add(id);else actor.statuses.delete(id);}};
 await syncZeroHealth(actor);assert.deepEqual(calls[0],['dead',{active:true,overlay:true}]);await syncZeroHealth(actor);assert.equal(calls.length,1);
 actor.system.health.value=2;await syncZeroHealth(actor);assert.equal(actor.statuses.has('dead'),false);
 actor.statuses.add('dead');await syncZeroHealth(actor);assert.equal(actor.statuses.has('dead'),true);
});
test('random tile chooses PNG assets only',()=>{assert.deepEqual(pngFiles(['a.png','b.PNG','a.jpg','folder/','x.png?v=1']),['a.png','b.PNG','x.png?v=1']);});

test('random tile spawns immediately, hidden and centred on the cursor captured before file loading',async()=>{
 const {randomTile}=await import('../system/scripts/random-tile.mjs');let data,folder;
 globalThis.game={i18n:{localize:key=>key},user:{isGM:true,getFlag:()=>({size:2})}};globalThis.ui={notifications:{info:()=>{}}};
 const scene={createEmbeddedDocuments:async(_type,items)=>{data=items[0];return items;}};
 globalThis.canvas={ready:true,scene,mousePosition:{x:300,y:400},grid:{size:100}};
 globalThis.foundry={applications:{apps:{FilePicker:{implementation:{browse:async(_source,path)=>{folder=path;canvas.mousePosition={x:999,y:999};return {files:['blood.png']};}}}}},canvas:{loadTexture:async()=>({width:400,height:200})}};
 await randomTile();assert.equal(folder,'assets/CODE RED/moulinette_assets/blood');assert.deepEqual(data,{hidden:true,texture:{src:'blood.png',anchorX:0.5,anchorY:0.5},x:300,y:400,width:200,height:100});
});


test('invalid PNG dimensions never create tile and a later valid request works',async()=>{
 const {randomTile}=await import('../system/scripts/random-tile.mjs');let writes=0;
 globalThis.game={i18n:{localize:key=>key},user:{isGM:true,getFlag:()=>({size:1})}};
 globalThis.canvas={ready:true,scene:{createEmbeddedDocuments:async()=>{writes++;}},mousePosition:{x:50,y:60},grid:{size:100}};
 globalThis.foundry={applications:{apps:{FilePicker:{implementation:{browse:async()=>({files:['blood.png']})}}}},canvas:{loadTexture:async()=>null}};
 await assert.rejects(randomTile(),/TileInvalidImage/);assert.equal(writes,0);
 foundry.canvas.loadTexture=async()=>({width:100,height:100});await randomTile();assert.equal(writes,1);
});


