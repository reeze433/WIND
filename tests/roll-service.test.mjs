import assert from "node:assert/strict";
import {test} from "node:test";
import {rollAttribute, evaluateCheck, checkHTML} from "../system/scripts/rolls.mjs";
import {rollSuccessDice} from "../system/scripts/chat-dice.mjs";
globalThis.game = {i18n: {localize: k => k}, settings: {get: () => "public"}};
globalThis.CONFIG = {ChatMessage: {modes: {public: {label: "Public"}}}};
let faces = [1,4,6], failChat = false, messages = [];
globalThis.Roll = class {
  constructor(formula) { this.formula = formula; this.dice = []; }
  async evaluate() { await Promise.resolve(); if (this.formula !== "0") this.dice = [{results: faces.map(result => ({result, active:true}))}]; return this; }
};
globalThis.ChatMessage = {getSpeaker: () => ({}), applyMode: (data, mode) => data.mode = mode, create: async data => { if (failChat) throw new Error("offline"); messages.push(data); return data; }};
const actor = () => ({uuid: "Actor.test", isOwner: true, system: {attributes:{combat:3}, inspiration:{value:2}}, async update(data) { this.system.inspiration.value = data["system.inspiration.value"]; return this; }});
test("roll service stores symbols and faces; zero pool stays zero", async () => {
  assert.equal((await evaluateCheck({pool:3})).total,3);
  const zero = await evaluateCheck({pool:0}); assert.equal(zero.total,0); assert.deepEqual(zero.attempts[0].faces,[]);
});
test("permission rejection occurs before any update", async () => {
  const a=actor(); a.isOwner=false;
  await assert.rejects(rollAttribute(a,"combat",{fastForward:true,spend:1})); assert.equal(a.system.inspiration.value,2);
});
test("cancel spends no inspiration", async () => {
  globalThis.foundry = {applications:{api:{DialogV2:{prompt:async()=>null}}}};
  const a=actor(); assert.equal(await rollAttribute(a,"combat"),null); assert.equal(a.system.inspiration.value,2);
});
test("double submit from same client spends once and records snapshot", async () => {
  const a=actor(); messages=[];
  const results=await Promise.all([rollAttribute(a,"combat",{fastForward:true,spend:1}),rollAttribute(a,"combat",{fastForward:true,spend:1})]);
  assert.equal(results.filter(Boolean).length,1); assert.equal(a.system.inspiration.value,1);
  assert.deepEqual(messages[0].flags.vitruviy.check.attempts[0].faces,[1,4,6]);
});
test("failed chat creation refunds spend and unlocks check", async () => {
  const a=actor(); failChat=true;
  await assert.rejects(rollAttribute(a,"combat",{fastForward:true,spend:1})); assert.equal(a.system.inspiration.value,2);
  failChat=false; assert.equal((await rollAttribute(a,"combat",{fastForward:true})).total,3);
});
test("text in chat is escaped", () => {
  const html=checkHTML({pool:0,mode:"normal",repeats:0,attempts:[{symbols:[],total:0}],selected:0,total:0,difficulty:null},"<img>","<script>alert(1)</script>");
  assert.ok(!html.includes("<script>")); assert.ok(html.includes("&lt;img&gt;")); assert.ok(!html.includes("alert(1)"));
});
test("compact attribute dialog has two selectors and defaults to one repeat", async () => {
  let content;
  globalThis.foundry = {applications:{api:{DialogV2:{prompt:async config => {
    content=config.content; return {mode:"advantage",rollMode:"gm"};
  }}}}};
  messages=[];
  const a=actor(), result=await rollAttribute(a,"combat");
  assert.equal((content.match(/<select /g)||[]).length,2);
  assert.ok(!content.includes('<input'));
  assert.equal(result.attempts.length,2);
  assert.equal(messages[0].mode,"gm");
  assert.equal(a.system.inspiration.value,2);
});
test("custom success dice work without actor, preserve faces and privacy", async () => {
  messages=[];
  assert.equal((await rollSuccessDice(3,{messageMode:"gm"})).total,3);
  assert.equal(messages[0].mode,"gm");
  assert.equal(messages[0].flags.vitruviy.check.custom,true);
  assert.deepEqual(messages[0].flags.vitruviy.check.attempts[0].faces,[1,4,6]);
  for (const count of [0,-1,1.5,101,"bad"]) await assert.rejects(rollSuccessDice(count));
});
test("custom success dice modes produce a second attempt", async () => {
  for (const mode of ["advantage", "disadvantage"]) {
    const result = await rollSuccessDice(3, {mode, messageMode: "public"});
    assert.equal(result.mode, mode); assert.equal(result.attempts.length, 2);
  }
  assert.equal((await rollSuccessDice(3)).attempts.length, 1);
});
