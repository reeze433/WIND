import assert from "node:assert/strict";
import {test} from "node:test";
import {successes, selectAttempt, validateCheck} from "../system/scripts/dice.mjs";
test("distribution and canonical 1,4,6 example", () => {
  assert.deepEqual([1,2,3,4,5,6].map(successes), [0,0,0,1,1,2]);
  assert.equal([1,4,6].reduce((a,f) => a + successes(f),0), 3);
});
test("advantage/disadvantage choose entire pool and keep first tie", () => {
  const attempts = [1,4,2].map(total => ({total}));
  assert.equal(selectAttempt(attempts, "advantage"), 1);
  assert.equal(selectAttempt(attempts, "disadvantage"), 0);
  assert.equal(selectAttempt([{total:4},{total:4}], "advantage"), 0);
});
test("zero pool, cap two repeats and malformed inputs", () => {
  assert.equal(validateCheck({pool:0, mode:"normal", repeats:2}).repeats,0);
  for (const params of [{pool:-1},{pool:1.5},{pool:101},{pool:1,mode:"both"},{pool:1,repeats:3},{pool:1,difficulty:-1}]) assert.throws(() => validateCheck(params));
  assert.throws(() => successes(7));
});
