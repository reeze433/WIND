import test from "node:test";
import assert from "node:assert/strict";
class Field{constructor(options){this.options=options;}}
globalThis.foundry={applications:{api:{ApplicationV2:class{},HandlebarsApplicationMixin:base=>base}},abstract:{TypeDataModel:class{static migrateData(data){return data;}}},data:{fields:{ArrayField:class extends Field{constructor(element,options){super(options);this.element=element;}},NumberField:Field,StringField:Field,BooleanField:Field,SchemaField:Field,ObjectField:Field,HTMLField:Field}}};
const {CardData,CharacterData}=await import("../system/scripts/models.mjs");
test("legacy six card ranks migrate E through S without dropping descriptions or raw legacy damage",()=>{
 for(let level=1;level<=6;level++) {const data={level,description:"Keep",damage:9};CardData.migrateData(data);assert.equal(data.tier,["E","D","C","B","A","S"][level-1]);assert.equal(data.description,"Keep");assert.equal(data.damage,9);}
});
test("explicit tier survives future reloads; new cards default to E with rolls disabled",()=>{
 const data={level:1,tier:"B"};CardData.migrateData(data);assert.equal(data.tier,"B");
 const schema=CardData.defineSchema();assert.equal(schema.tier.options.initial,"E");assert.equal(schema.rollEnabled.options.initial,false);assert.equal(schema.dealsDamage.options.initial,false);
});
test("tier controls derived modifier",()=>{const data=Object.create(CardData.prototype);data.tier="B";data.damage=99;data.prepareDerivedData();assert.equal(data.damage,3);});

test("plain biography migrates to rich text without losing newlines; existing HTML retained",()=>{const data={biography:"Hello\nWorld",notes:"<p><strong>Bold</strong></p>"};CharacterData.migrateData(data);assert.equal(data.biography,"<p>Hello<br>World</p>");assert.equal(data.notes,"<p><strong>Bold</strong></p>");});


test('each new item receives its own independent empty mode list',()=>{const field=CardData.defineSchema().actionModes;assert.equal(typeof field.options.initial,'function');const first=field.options.initial(),second=field.options.initial();first.push({id:'example'});assert.deepEqual(second,[]);});
