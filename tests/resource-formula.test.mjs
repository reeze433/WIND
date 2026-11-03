import test from 'node:test';import assert from 'node:assert/strict';
import {resourceFormula} from '../system/scripts/resource-formula.mjs';
const attributes={wellbeing:3,attention:2,movement:4,combat:3,thinking:5,communication:1};
test('resource arithmetic supports Russian, attribute aliases and normal precedence',()=>{
 assert.equal(resourceFormula('(Мышление + Сражение)*2',attributes),16);
 assert.equal(resourceFormula('(аттрибут_*мышление + аттрибут_*сражение)*2',attributes),16);
 assert.equal(resourceFormula('@attributes.thinking + @system.attributes.combat * 2',attributes),11);
 assert.equal(resourceFormula('2 + 3 * (4 - 1)'),11);
 assert.equal(resourceFormula('8 ÷ 2 − 1'),3);
});
test('rounding and caps can be expressed explicitly',()=>{
 assert.equal(resourceFormula('floor(Мышление/2)',attributes),2);
 assert.equal(resourceFormula('ceil(Мышление/2)',attributes),3);
 assert.equal(resourceFormula('max(0, min(12, Мышление * 3))',attributes),12);
 assert.equal(resourceFormula('round(2.5)+abs(-2)'),5);
});

test('recovery can use maximum context while maximum cannot reference itself',()=>{
 assert.equal(resourceFormula('floor(Максимум/6)',{}, {maximum:24}),4);
 assert.equal(resourceFormula('round(maximum/6)',{}, {maximum:16}),3);
 assert.equal(resourceFormula('ceil(@max/6)',{}, {maximum:16}),3);
 assert.throws(()=>resourceFormula('Максимум/6'));
});
test('invalid, executable, random, infinite and overly complex formulas are refused',()=>{
 for(const formula of ['', '1/0','unknown+1','Math.random()','globalThis.process.exit()','1;alert(1)','2d6','(2+3','floor(2,3)','1e309','('.repeat(40)+'1'+')'.repeat(40)])assert.throws(()=>resourceFormula(formula,attributes),formula);
});
