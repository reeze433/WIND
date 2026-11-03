import {healthMultiplier} from "./settings.mjs";
import {prepareChargeData} from './charge-formula.mjs';
import {ATTRIBUTES} from "./dice.mjs";
import {TIERS, tierModifier} from "./tiers.mjs";
const f = foundry.data.fields;
const integer = (initial, min = 0, max) => new f.NumberField({required: true, nullable: false, integer: true, initial, min, ...(max === undefined ? {} : {max})});
export class CharacterData extends foundry.abstract.TypeDataModel {
  static migrateData(source) {
    for (const key of ["biography", "notes"]) {
      if (source[key] && !/<\/?[a-z][\s\S]*>/i.test(source[key])) source[key] = `<p>${String(source[key]).replace(/[&<>]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])).replace(/\r?\n/g,"<br>")}</p>`;
    }
    return super.migrateData(source);
  }
  static defineSchema() {
    return {
      attributes: new f.SchemaField(Object.fromEntries(ATTRIBUTES.map(k => [k, integer(1, 0, 6)]))),
      attackBonuses:new f.SchemaField(Object.fromEntries(ATTRIBUTES.map(k=>[k,integer(0,-100,100)]))),
      defenseBonuses:new f.SchemaField(Object.fromEntries(ATTRIBUTES.map(k=>[k,integer(0,-100,100)]))),
      health: new f.SchemaField({value: integer(5), max: integer(5)}),
      inspiration: new f.SchemaField({value: integer(0)}),
      experience: new f.SchemaField({value: integer(6)}),
      level: integer(1, 1), archetype: new f.StringField({initial: ""}),
      currencies: new f.ObjectField({initial: {}}),
      customResources:new f.ObjectField({initial:{}}),
      biography: new f.HTMLField({initial: ""}), notes: new f.HTMLField({initial: ""}),
      schemaVersion: integer(3, 1)
    };
  }
  prepareDerivedData() {
    this.health.max = this.attributes.wellbeing * healthMultiplier();
    this.health.value = Math.min(this.health.value, this.health.max);
    for(const item of this.parent?.items?.values()??[])prepareChargeData(item.system,this.parent,item._source?.system?.charges);
  }
}
export class CardData extends foundry.abstract.TypeDataModel {
  static migrateData(source) {
    if (source.category === "trait") source.category = "ability";
    if (source.tier === undefined && source.level !== undefined) {
      // The six legacy card ranks 1–6 correspond to E–S; retain level in the source.
      const modifier = Math.max(0, Number(source.level) - 1);
      source.tier = ["E", "D", "C", "B", "A", "S"][Math.max(0, Math.min(5, modifier))] ?? "E";
    }
    return super.migrateData(source);
  }
  static defineSchema() {
    return {actionModes:new f.ArrayField(new f.ObjectField(),{initial:()=>[]}),category:new f.StringField({initial:'equipment',choices:['condition','ability','equipment','custom','other']}), level: integer(1, 0, 6), description: new f.HTMLField({initial: ""}), privateDescription: new f.HTMLField({initial: ""}),
      customResourceId:new f.StringField({initial:''}),customResourceCost:integer(1,1),
      quantityUsage:new f.StringField({initial:'auto',choices:['auto','none','consume']}),quantityCost:integer(1,1),
      quantity: integer(1), price: integer(0), damage: integer(1), cost: integer(0), inspirationEnabled: new f.BooleanField({initial: false}),
      areaEnabled:new f.BooleanField({initial:false}),areaPlacement:new f.StringField({initial:'point',choices:['point','self']}),areaShape:new f.StringField({initial:'circle',choices:['circle','cone','line','rectangle']}),areaSize:new f.NumberField({initial:1,min:0.1,max:1000,required:true,nullable:false}),areaWidth:new f.NumberField({initial:1,min:0.1,max:1000,required:true,nullable:false}),areaAngle:new f.NumberField({initial:90,min:1,max:360,required:true,nullable:false}),
      effectEnabled:new f.BooleanField({initial:false}),effectName:new f.StringField({initial:''}),
      effectTarget:new f.StringField({initial:'target',choices:['self','target']}),effectAttribute:new f.StringField({initial:'choose',choices:['choose',...ATTRIBUTES]}),
      effectBranch:new f.StringField({initial:'base',choices:['base','attack','defense']}),
      rollBranch:new f.StringField({initial:'attack',choices:['base','attack','defense']}),
      restRecovery:new f.BooleanField({initial:false}),
      effectBonus:integer(1,-6,6),
      gridPosition:new f.SchemaField({x:integer(-1,-1,511),y:integer(-1,-1,511)}),gridCollapsed:new f.BooleanField({initial:false}),gridWidth:integer(3,3,5),
      prepared:new f.BooleanField({initial:false}),chargesMaxFormula:new f.StringField({initial:''}),
      chargesEnabled:new f.BooleanField({initial:false}),charges:new f.SchemaField({value:integer(1),max:integer(1)}),chargeCost:integer(1,1),
      chargeSourceId:new f.StringField({initial:''}),sourceChargeCost:integer(1,1),
      chargeReceiverId:new f.StringField({initial:''}),restoreChargeAmount:integer(1,1),chargeRestoreFull:new f.BooleanField({initial:false}),
      hasTier: new f.BooleanField({initial:true}),
      tier: new f.StringField({required: true, nullable: false, initial: "E", choices: Object.keys(TIERS)}),
      rollEnabled: new f.BooleanField({initial: false}), dealsDamage: new f.BooleanField({initial: false}),
      attribute: new f.StringField({initial: "combat", choices: ATTRIBUTES}), schemaVersion: integer(2, 1)};
  }
  prepareDerivedData() { this.damage = tierModifier(this.tier); prepareChargeData(this,this.parent?.actor,this.parent?._source?.system?.charges); }
}


