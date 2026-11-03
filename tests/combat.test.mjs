import test from "node:test";
import assert from "node:assert/strict";

const settings = new Map([["initiativeAttribute", "combat"], ["healthPerWellbeing", 5]]);
globalThis.game = {settings: {get: (_scope, key) => settings.get(key) ?? "public", registerMenu: ()=>{}, register: (_scope, key, value) => registered.set(key, value)}, i18n: {localize: key => key}};
const registered = new Map();
globalThis.CONST={GRID_DIAGONALS:{EQUIDISTANT:0,APPROXIMATE:2,RECTILINEAR:3}};
globalThis.Hooks={on:()=>{}};
globalThis.foundry = {applications:{api:{ApplicationV2:class{},HandlebarsApplicationMixin:base=>base}},utils: {mergeObject: (a,b) => ({...a,...b})}, data: {fields: {NumberField: class { constructor(options) {this.options=options;} }}}};
const {installCombat, registerSettings} = await import("../system/scripts/settings.mjs");
let messages = [];
globalThis.ChatMessage = {getSpeaker: ({alias}) => ({alias}), applyMode: (message, mode) => message.mode=mode, create: async value => messages.push(...value)};
globalThis.Roll = class {
  constructor(formula) { this.formula=formula; this.dice=[]; }
  async evaluate() {
    const faces = this.formula === "4d6" ? [4,4,1,1] : this.formula === "3d6" ? [4,4,4] : [];
    this.dice=[{results: faces.map(result=>({result,active:true}))}]; return this;
  }
};
class BaseCombat {
  constructor() {
    this.turn=0;
    this.combatants=new Map([["player",{id:"player",name:"Player",isOwner:true,initiative:null,actor:{system:{attributes:{combat:4}}}}],["enemy",{id:"enemy",name:"Enemy",isOwner:true,hidden:true,initiative:null,actor:{system:{attributes:{combat:3}}}}]]);
  }
  async updateEmbeddedDocuments(_type, updates, options) { this.lastOptions=options; for(const u of updates) Object.assign(this.combatants.get(u._id),u); }
  async rollAll(options) { return this.rollInitiative([...this.combatants.values()].filter(c=>c.isOwner && c.initiative===null).map(c=>c.id),options); }
  async startCombat() {this.started=true; this.first=[...this.combatants.values()].sort((a,b)=>b.initiative-a.initiative)[0].id; return this;}
}
function combat() { globalThis.CONFIG={Combat:{documentClass:BaseCombat}}; installCombat(); return new CONFIG.Combat.documentClass(); }
test("initiative rolls successes: player 4 dice yields 2; enemy 3 dice yields 3 and acts first",async()=>{
  messages=[]; const c=combat(); await c.startCombat();
  assert.equal(c.combatants.get("player").initiative,2); assert.equal(c.combatants.get("enemy").initiative,3); assert.equal(c.first,"enemy");
  assert.equal(messages[1].mode,"gm"); assert.deepEqual(messages[0].flags.vitruviy.check.attempts[0].faces,[4,4,1,1]);
  assert.equal(messages[0].flags.core.initiativeRoll,true);
});
test("starting combat preserves already rolled initiative; manual reroll replaces it; nonowner is skipped",async()=>{
  const c=combat(); c.combatants.get("player").initiative=8; await c.startCombat(); assert.equal(c.combatants.get("player").initiative,8);
  await c.rollInitiative("player"); assert.equal(c.combatants.get("player").initiative,2);
  c.combatants.get("player").isOwner=false; c.combatants.get("player").initiative=9; await c.rollInitiative("player"); assert.equal(c.combatants.get("player").initiative,9);
});
test("rules keep their existing storage keys behind the settings hub; health multiplier has an integer nonnegative field",()=>{
  globalThis.CONFIG={Combat:{documentClass:BaseCombat}}; registerSettings();
  assert.equal(registered.get("initiativeAttribute").config,false); assert.equal(Object.keys(registered.get("initiativeAttribute").choices).length,6);
  assert.equal(registered.get("healthPerWellbeing").type.options.min,0); assert.equal(registered.get("healthPerWellbeing").type.options.integer,true);
});
