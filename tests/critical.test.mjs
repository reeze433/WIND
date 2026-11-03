import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateCheck,checkHTML} from '../system/scripts/rolls.mjs';
let enabled=false,pools=[];
globalThis.game={settings:{get:()=>enabled},i18n:{localize:k=>k}};
globalThis.Roll=class{constructor(){this.dice=[];}async evaluate(){this.dice=[{results:pools.shift().map(result=>({result}))}];return this;}};
test('critical requires enabled setting and a double-success face, not two single successes',async()=>{
 pools=[[6]];let result=await evaluateCheck({pool:1});assert.equal(result.critical,false);
 enabled=true;pools=[[4,5]];result=await evaluateCheck({pool:2});assert.equal(result.total,2);assert.equal(result.critical,false);
 pools=[[6]];result=await evaluateCheck({pool:1});assert.equal(result.total,2);assert.equal(result.critical,true);assert.match(checkHTML(result,'Check'),/vit-critical/);
 enabled=false;assert.match(checkHTML(result,'Check'),/vit-critical/); // Stored outcome survives later setting changes.
});
test('critical uses only selected advantage/disadvantage pool',async()=>{
 enabled=true;pools=[[6,1,1],[4,4,4]];let result=await evaluateCheck({pool:3,mode:'advantage',repeats:1});assert.equal(result.total,3);assert.equal(result.critical,false);
 pools=[[6,1,1],[4,4,4]];result=await evaluateCheck({pool:3,mode:'disadvantage',repeats:1});assert.equal(result.total,2);assert.equal(result.critical,true);
});
