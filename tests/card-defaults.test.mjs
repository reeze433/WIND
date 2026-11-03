import test from 'node:test';import assert from 'node:assert/strict';
import {cardDefaults,normalizeCardDefaults} from '../system/scripts/card-defaults.mjs';
import {layoutCards,gridViewportGeometry,placeCard,validPosition} from '../system/scripts/card-grid.mjs';
const card=(id,pos={})=>({id,system:{gridWidth:3,gridPosition:pos}});
test('defaults validate widths and independent panel limits without changing old cards',()=>{
 assert.deepEqual(normalizeCardDefaults({gridWidth:5,grids:{equipment:512,ability:32,custom:128}}),{gridWidth:5,grids:{equipment:512,ability:32,custom:128}});
 assert.deepEqual(normalizeCardDefaults({gridWidth:99,grids:{equipment:100000}}),{gridWidth:3,grids:{ability:64,equipment:64,custom:64}});
 globalThis.game={settings:{get:()=>{throw Error('not registered');}}};assert.equal(cardDefaults().gridWidth,3);
});
test('zoom reveals additional visible cells while honoring the configured maximum',()=>{
 assert.equal(gridViewportGeometry(960,1,64).columns,20);assert.equal(gridViewportGeometry(960,.6,64).columns,33);
 assert.equal(gridViewportGeometry(960,.6,32).columns,32);assert.ok(gridViewportGeometry(960,.6,64).rows>gridViewportGeometry(960,1,64).rows);
 const anchored={x:50,y:40,w:5,h:6};assert.equal(gridViewportGeometry(960,.6,64,[anchored]).columns,55);
});
test('coordinates beyond old eighteen columns work, persist across scales, and reject configured edges',()=>{
 const items=[card('a',{x:49,y:40})],options={columns:20,boundsColumns:64,limit:64};
 const normal=layoutCards(items,options),small=layoutCards(items,{...options,columns:33});assert.deepEqual(normal.rects.get('a'),small.rects.get('a'));
 assert.deepEqual(placeCard(items,items[0],{x:61,y:58},options),{x:61,y:58});assert.throws(()=>placeCard(items,items[0],{x:62,y:58},options),/bounds/);
 assert.equal(validPosition({x:29,y:26},{w:3,h:6},{columns:32,limit:32}),true);
});
test('full small grid reports overflow without losing cards or constructing cells',()=>{
 const items=Array.from({length:51},(_,i)=>card(String(i)));const layout=layoutCards(items,{columns:32,boundsColumns:32,limit:32});
 assert.equal(layout.rects.size,50);assert.equal(layout.overflow.size,1);assert.equal(layout.rects.size+layout.overflow.size,items.length);
 const enlarged=layoutCards(items,{columns:32,boundsColumns:64,limit:64});assert.equal(enlarged.overflow.size,0);
 const big=layoutCards([card('a',{x:509,y:506})],{columns:20,boundsColumns:512,limit:512});assert.equal(big.rects.size,1);assert.equal(big.columns,512);assert.equal(big.rows,512);
});
