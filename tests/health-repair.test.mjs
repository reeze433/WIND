import test from 'node:test';import assert from 'node:assert/strict';
import {repairHealthEstimate} from '../system/scripts/vision.mjs';
const values={'core.custom.FractionHP':'actor.system.health.value','core.custom.FractionMath':1};
globalThis.game={user:{isGM:true},modules:new Map([['healthEstimate',{active:true}]]),settings:{get:(_m,k)=>values[k],set:async(_m,k,v)=>values[k]=v},healthEstimate:{updateSettings:()=>{}},i18n:{localize:x=>x}};globalThis.canvas={tokens:{placeables:[]}};
test('Health Estimate receives resource object instead of numeric value and current/max calculation',async()=>{await repairHealthEstimate();assert.equal(values['core.custom.FractionHP'],'actor.system.health');assert.equal(values['core.custom.FractionMath'],0);game.user.isGM=false;await assert.rejects(repairHealthEstimate());});
