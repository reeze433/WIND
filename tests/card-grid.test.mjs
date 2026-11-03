import test from 'node:test';import assert from 'node:assert/strict';
import {cardSize,layoutCards,placeCard,intersects,validPosition} from '../system/scripts/card-grid.mjs';
import {moveGridCard,toggleGridCard,resizeGridItem} from '../system/scripts/card-grid-ui.mjs';
const card=(id,position={},collapsed=false)=>({id,system:{category:'equipment',gridPosition:position,gridCollapsed:collapsed}});

test('default card occupies 3 by 6; an independently collapsed card occupies one square',()=>{
 assert.deepEqual(cardSize(card('a')),{w:3,h:6});assert.deepEqual(cardSize(card('b',{},true)),{w:1,h:1});
 const {rects}=layoutCards([card('a'),card('b',{},true)]);assert.equal(rects.get('a').w,3);assert.equal(rects.get('a').h,6);assert.equal(rects.get('b').w,1);assert.equal(intersects(rects.get('a'),rects.get('b')),false);
});
test('expanded widths 3, 4 and 5 preserve six rows; compact form remains one cell',()=>{
 for(const width of [3,4,5]){const item=card('sized');item.system.gridWidth=width;assert.deepEqual(cardSize(item),{w:width,h:6});assert.deepEqual(cardSize(item,true),{w:1,h:1});}
 const wide=card('wide',{x:14,y:0});wide.system.gridWidth=5;const layout=layoutCards([wide]);assert.ok(layout.rects.get('wide').x+5<=18);
});
test('saved positions reserve space before unpositioned cards and recover corrupt overlapping data deterministically',()=>{
 const items=[card('new'),card('saved',{x:0,y:0}),card('bad',{x:0,y:0}),card('negative',{x:-1,y:-1})];
 const layout=layoutCards(items);assert.deepEqual(layout.rects.get('saved'),{w:3,h:6,x:0,y:0});
 const rects=[...layout.rects.values()];for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++)assert.equal(intersects(rects[i],rects[j]),false);
 assert.deepEqual(layoutCards(items).rects,layout.rects);
});
test('moving accepts empty space and rejects overlaps, edges and invalid coordinates',()=>{
 const a=card('a',{x:0,y:0}),b=card('b',{x:3,y:0});
 assert.deepEqual(placeCard([a,b],a,{x:9,y:2}),{x:9,y:2});assert.throws(()=>placeCard([a,b],a,{x:3,y:0}),/occupied/);
 for(const position of [{x:-1,y:0},{x:16,y:0},{x:0,y:510},{x:1.5,y:0},{x:NaN,y:0}])assert.equal(validPosition(position,{w:3,h:6}),false);
 assert.deepEqual(layoutCards([a,b],{manual:false}).rects.get('b'),{w:3,h:6,x:3,y:0});
});
function sheetFixture(){
 globalThis.game={user:{setFlag:async()=>{}},i18n:{localize:key=>key}};
 const a=card('a',{x:0,y:0}),b=card('b',{x:3,y:0});const items=[a,b];items.get=id=>items.find(item=>item.id===id);items.filter=Array.prototype.filter;
 const actor={uuid:'Actor.qa',items,updateEmbeddedDocuments:async(_type,updates)=>{for(const update of updates){const item=items.get(update._id);for(const [key,value]of Object.entries(update))if(key==='system')Object.assign(item.system,value);else if(key.startsWith('system.'))item.system[key.slice(7)]=value;}return updates;}};
 for(const item of items)item.actor=actor;
 const sheet={actor,isEditable:true,_windCollapsed:[],_windLayouts:{equipment:layoutCards(items),custom:layoutCards([])},render:()=>{}};actor.sheet=sheet;return sheet;
}
test('drop saves positions for all siblings and supports moving between panels without cloning the item',async()=>{
 const sheet=sheetFixture(),a=sheet.actor.items.get('a');await moveGridCard(sheet,a,'custom',{x:6,y:6});assert.equal(a.system.category,'custom');assert.deepEqual(a.system.gridPosition,{x:6,y:6});assert.equal(sheet.actor.items.length,2);
 sheet.isEditable=false;await assert.rejects(moveGridCard(sheet,a,'custom',{x:9,y:0}),/NoPermission/);
});
test('retired card grid stays disabled even with a saved grid layout setting',async()=>{
 const {usesCardGrid}=await import('../system/scripts/card-defaults.mjs');
 const previous=globalThis.game;globalThis.game={settings:{get:()=> 'grid'}};
 try{assert.equal(usesCardGrid(),false);}finally{globalThis.game=previous;}
});
test('resizing in the editor preserves neighboring positions and relocates only the resized card when necessary',async()=>{
 const sheet=sheetFixture(),a=sheet.actor.items.get('a'),b=sheet.actor.items.get('b');
 await resizeGridItem(a,{system:{gridWidth:5,description:'Kept'}});assert.equal(a.system.gridWidth,5);assert.equal(a.system.description,'Kept');
 assert.deepEqual(b.system.gridPosition,{x:3,y:0});assert.equal(intersects({...a.system.gridPosition,...cardSize(a)},{...b.system.gridPosition,...cardSize(b)}),false);
});
test('moving out of a panel also fixes the former siblings at their visible positions',async()=>{
 const sheet=sheetFixture(),a=sheet.actor.items.get('a'),b=sheet.actor.items.get('b');b.system.gridPosition={x:-1,y:-1};sheet._windLayouts.equipment=layoutCards(sheet.actor.items);
 await moveGridCard(sheet,a,'custom',{x:0,y:0});assert.deepEqual(b.system.gridPosition,{x:3,y:0});
});

test('list mode independently collapses cards without rewriting saved grid coordinates',async()=>{
 const sheet=sheetFixture(),a=sheet.actor.items.get('a'),before=sheet.actor.items.map(item=>structuredClone(item.system.gridPosition));game.settings={get:()=> 'list'};
 a.update=async update=>{for(const [key,value]of Object.entries(update))a.system[key.slice(7)]=value;};
 await toggleGridCard(sheet,{closest:()=>({dataset:{itemId:'a'}})});assert.equal(a.system.gridCollapsed,true);assert.deepEqual(sheet.actor.items.map(item=>item.system.gridPosition),before);
});
