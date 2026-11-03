import test from 'node:test';
import assert from 'node:assert/strict';
import {rollCoin, validCoinIcon} from '../system/scripts/coin.mjs';
let face=1, messages=[];
globalThis.game={i18n:{localize:k=>k},settings:{get:(_scope,key)=>key==='messageMode'?'gm':undefined}};
globalThis.Roll=class{constructor(formula){assert.equal(formula,'1d2');}async evaluate(){this.total=face;return this;}};
globalThis.ChatMessage={getSpeaker:()=>({}),applyMode:(msg,mode)=>msg.mode=mode,create:async msg=>messages.push(msg)};
test('d2: 1 fails, 2 succeeds, configured icon and visibility snapshot preserved',async()=>{
 assert.equal((await rollCoin()).success,false);assert.equal(messages[0].mode,'gm');assert.ok(messages[0].content.includes('VIT.CoinFailure'));assert.equal(messages[0].flags.vitruviy.coin.atlas.frames['failure.png'].frame.x,308);
 face=2;assert.equal((await rollCoin()).success,true);assert.ok(messages[1].content.includes('VIT.CoinSuccess'));assert.equal(messages[1].flags.vitruviy.coin.face,2);assert.notEqual(messages[0].content,messages[1].content);
 for(const message of messages)assert.doesNotMatch(message.content,/<img|<svg|background-image|coin\.png|d2:/);
});
test('invalid result and unowned actor rejected; icons accept raster formats and reject unsafe URLs',async()=>{
 face=3;await assert.rejects(rollCoin());await assert.rejects(rollCoin({actor:{isOwner:false}}));
 assert.equal(validCoinIcon('icons/test.svg'),true);assert.equal(validCoinIcon('javascript:test.svg'),false);assert.equal(validCoinIcon('test.png'),true);
});


