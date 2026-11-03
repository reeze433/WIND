import test from 'node:test';import assert from 'node:assert/strict';
import {readCoinAtlas,saveCoinAtlas,validateCoinFrames,coinAtlasHTML} from '../system/scripts/coin-atlas.mjs';
globalThis.location={href:'http://gm-machine:30001/game'};
globalThis.Image=class{naturalWidth=512;naturalHeight=256;async decode(){}};
const frames={'success.png':{frame:{x:0,y:0,w:256,h:256}},'failure.png':{frame:{x:256,y:0,w:256,h:256}}};
let uploaded;
globalThis.fetch=async()=>({ok:true,json:async()=>({frames,meta:{image:'coin.webp'}})});
const picker={browse:async()=>({dirs:[]}),createDirectory:async()=>{},upload:async(_s,_p,file)=>{uploaded=JSON.parse(await file.text());return {path:'vitruviy-assets/test.json'};}};
globalThis.foundry={applications:{apps:{FilePicker:{implementation:picker}}}};
test('WEBP sprite sheet preserves success on left and failure on right; image path works on other player hosts',async()=>{
 const atlas=await readCoinAtlas('art/two-sides.webp');assert.equal(atlas.image,'/art/two-sides.webp');assert.equal(atlas.frames['success.png'].frame.x,0);assert.equal(atlas.frames['failure.png'].frame.x,256);
 assert.match(coinAtlasHTML(atlas,true,'Success'),/background-position:0%/);assert.match(coinAtlasHTML(atlas,false,'Failure'),/background-position:100%/);
});
test('saving image uploads real atlas JSON pointing to WEBP; JSON input resolves sibling image',async()=>{
 const saved=await saveCoinAtlas('art/two-sides.webp');assert.equal(saved.texture,'vitruviy-assets/test.json');assert.equal(uploaded.frames['failure.png'].frame.x,256);assert.match(uploaded.meta.image,/^\.\.\/art\/two-sides.webp\?v=/);
 const atlas=await readCoinAtlas('art/custom.json');assert.equal(atlas.image,'/art/coin.webp');
});
test('out-of-bounds or missing frames and unsafe atlas paths are rejected',async()=>{
 assert.throws(()=>validateCoinFrames({meta:{image:'a.webp'},frames:{}},512,256));
 assert.throws(()=>validateCoinFrames({meta:{image:'a.webp'},frames:{...frames,'failure.png':{frame:{x:500,y:0,w:256,h:256}}}},512,256));
 await assert.rejects(readCoinAtlas('javascript:coin.webp'));
});
