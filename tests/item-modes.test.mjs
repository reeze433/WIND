import test from 'node:test';import assert from 'node:assert/strict';
import {normalizeActionMode,effectiveModeItem} from '../system/scripts/item-modes.mjs';
import {itemAvailability} from '../system/scripts/item-availability.mjs';
import {rollItem} from '../system/scripts/items.mjs';
import {processResourceRequest} from '../system/scripts/operations.mjs';
let item,actor,messages;
const melee=()=>({id:'melee',name:'Melee',overrides:{chargesEnabled:false,areaEnabled:true,areaShape:'circle',areaSize:1.5},valueMode:'healing'});
function setup(){messages=[];const gm={id:'gm',isGM:true};const users=[gm];users.activeGM=gm;users.get=()=>gm;
 globalThis.game={user:gm,users,i18n:{localize:k=>k},settings:{get:(_s,k)=>k==='customResourceCount'?0:'public'}};globalThis.ui={notifications:{info:()=>{},warn:()=>{},error:()=>{}}};globalThis.canvas={tokens:{controlled:[]}};
 globalThis.foundry={applications:{ux:{TextEditor:{enrichHTML:async x=>x}}}};
 globalThis.ChatMessage={getSpeaker:()=>({}),applyMode:()=>{},create:async data=>{messages.push(data);return data;}};
 globalThis.Roll=class{async evaluate(){this.dice=[{results:[{result:4,active:true}]}];return this;}toJSON(){return {};}static fromData(){return {};}};
 actor={uuid:'Actor.a',id:'a',isOwner:true,effects:[],flags:{},system:{attributes:{combat:2},inspiration:{value:3}},items:new Map(),testUserPermission:()=>true,getFlag(_s,k){return this.flags[k]},async update(data){for(const[k,v]of Object.entries(data))if(k.startsWith('flags.vitruviy.'))this.flags[k.slice(15)]=v;return this;}};
 item={id:'i',uuid:'Actor.a.Item.i',isOwner:true,name:'Weapon',actor,flags:{},system:{actionModes:[melee()],quantity:1,quantityUsage:'none',rollEnabled:true,attribute:'combat',rollBranch:'attack',dealsDamage:true,hasTier:true,tier:'S',inspirationEnabled:false,cost:0,chargesEnabled:true,charges:{value:0,max:1},chargeCost:1},getFlag(_s,k){return this.flags[k]},async update(data){for(const[k,v]of Object.entries(data)){if(k==='system.actionModes')this.system.actionModes=v;if(k==='flags.vitruviy.actionModesMigrated')this.flags.actionModesMigrated=v;}return this;}};actor.items.set(item.id,item);game.actors=[actor];
}
test('modes reject arbitrary system fields, invalid values and missing names',()=>{setup();assert.equal(normalizeActionMode(melee()).overrides.areaSize,1.5);for(const mode of [{...melee(),name:''},{...melee(),overrides:{health:99}},{...melee(),overrides:{chargesEnabled:'false'}},{...melee(),overrides:{chargeCost:0}},{...melee(),overrides:{areaShape:'invalid'}}])assert.throws(()=>normalizeActionMode(mode));});
test('effective settings inherit base values without modifying the real item',()=>{setup();const effective=effectiveModeItem(item,'melee');assert.equal(effective.id,item.id);assert.equal(effective.system.chargesEnabled,false);assert.equal(effective.system.attribute,'combat');assert.equal(item.system.chargesEnabled,true);assert.equal(effective.windMode.valueMode,'healing');assert.throws(()=>effectiveModeItem(item,'removed'));});
test('an empty ranged weapon remains usable when a mode has no charge cost',()=>{setup();assert.equal(itemAvailability(item).useDisabled,false);item.system.actionModes=[{id:'ranged',name:'Ranged',overrides:{}}];assert.equal(itemAvailability(item).useDisabled,false);});
test('mode activation uses its costs, area and value type without persisting overrides',async()=>{setup();await rollItem(item,{modeId:'melee',fastForward:true});assert.equal(messages.length,1);assert.equal(messages[0].flags.vitruviy.item.modeId,'melee');assert.equal(messages[0].flags.vitruviy.item.valueMode,'healing');assert.equal(messages[0].flags.vitruviy.item.area.shape,'circle');assert.equal(item.system.chargesEnabled,true);assert.equal(item.system.charges.value,0);});
