import test from 'node:test';import assert from 'node:assert/strict';
import {rollAttribute} from '../system/scripts/rolls.mjs';
import {rollItem} from '../system/scripts/items.mjs';
import {defend,recordDefense} from '../system/scripts/targets.mjs';
import {styleHiddenRoll} from '../system/scripts/presentation.mjs';
import {processResourceRequest} from '../system/scripts/operations.mjs';
let hudSystem;globalThis.Hooks={once:()=>{},callAll:(_name,value)=>hudSystem=value};
const {installHud}=await import('../system/scripts/hud.mjs');
let actor,item,messages,prompts,dice,choice;
function setup(){
 messages=[];prompts=[];dice=[];choice=null;
 actor={id:'a',uuid:'Actor.a',name:'Hero',isOwner:true,flags:{},items:new Map(),effects:[],system:{attributes:{combat:3,thinking:2},attackBonuses:{combat:1},defenseBonuses:{combat:2},inspiration:{value:4}},getFlag(_scope,key){return this.flags[key];},async update(changes){for(const [key,value]of Object.entries(changes)){if(key==='system.inspiration.value')this.system.inspiration.value=value;else if(key.startsWith('flags.vitruviy.'))this.flags[key.slice(15)]=value;}return this;}};
 item={id:'weapon',uuid:'Actor.a.Item.weapon',name:'Weapon <unsafe>',isOwner:true,actor,system:{category:'equipment',prepared:true,rollEnabled:true,dealsDamage:true,attribute:'combat',rollBranch:'attack',tier:'C',quantity:1,quantityUsage:'none',description:'',inspirationEnabled:true,cost:1}};actor.items.set(item.id,item);
 const token=name=>({name,document:{uuid:`Scene.s.Token.${name}`},actor:{uuid:`Actor.${name}`,isOwner:true}}),a=token('Enemy <a>'),b=token('Ally');
 globalThis.game={user:{id:'gm',isGM:true,targets:new Set([a,b])},i18n:{localize:key=>key},settings:{get:()=> 'public'},vitruviy:{rollAttribute}};globalThis.canvas={tokens:{controlled:[]}};
 globalThis.foundry={applications:{api:{DialogV2:{prompt:async config=>{prompts.push(config);return typeof choice==='function'?choice(config):choice;}}},ux:{TextEditor:{enrichHTML:async text=>text}}}};
 globalThis.ui={notifications:{warn:()=>{},error:()=>{}}};
 globalThis.ChatMessage={getSpeaker:()=>({}),applyMode:(data,mode)=>data.mode=mode,create:async data=>{messages.push(data);return {id:'m'+messages.length};}};
 globalThis.Roll=class{constructor(formula){this.formula=formula;this.dice=[];}async evaluate(){dice.push(this.formula);this.dice=[{results:Array.from({length:Number.parseInt(this.formula)||0},()=>({result:4,active:true}))}];return this;}};
 return [a,b];
}
test('HUD attribute dialog offers base/attack/defense and rolls the selected branch including bonuses',async()=>{
 setup();installHud({api:{ActionHandler:class{},RollHandler:class{},SystemManager:class{}}});
 const handler=new hudSystem.api.SystemManager().getRollHandler();handler.actor=actor;handler.action={system:{actionType:'attribute',actionId:'combat'}};
 choice={branch:'defense',mode:'normal',rollMode:'public'};await handler.handleActionClick();
 assert.equal(prompts.length,1);assert.match(prompts[0].content,/name="branch"/);assert.match(prompts[0].content,/VIT.Attack \(4\)/);assert.match(prompts[0].content,/VIT.Defense \(5\)/);assert.deepEqual(dice,['5d6']);assert.equal(messages[0].flags.vitruviy.check.branch,'defense');assert.match(messages[0].content,/VIT.Defense/);
});
test('fixed attack or defense buttons keep their branch; invalid HUD choices do not roll',async()=>{
 setup();choice={branch:'defense',mode:'normal'};await rollAttribute(actor,'combat',{branch:'attack'});assert.deepEqual(dice,['4d6']);assert.equal(messages[0].flags.vitruviy.check.branch,'attack');
 choice={branch:'bogus'};await assert.rejects(rollAttribute(actor,'combat',{chooseBranch:true}),/InvalidCheck/);assert.equal(dice.length,1);
});




test('Other cards can be prepared from their button and enter/leave the Other HUD group without consuming quantity',async()=>{
 setup();foundry.applications.api.ApplicationV2=class{};foundry.applications.api.HandlebarsApplicationMixin=base=>base;foundry.applications.sheets={ActorSheetV2:class{},ItemSheetV2:class{}};
 const {VitruviyActorSheet}=await import('../system/scripts/sheets.mjs');
 const magazine={id:'magazine',name:'Обойма',system:{category:'other',prepared:false,quantity:2},async update(changes){assert.deepEqual(Object.keys(changes),['system.prepared']);this.system.prepared=changes['system.prepared'];}};actor.items.set(magazine.id,magazine);
 const target={closest:()=>({dataset:{itemId:'magazine'}})},sheet={actor,isEditable:true};
 class ActionHandler{addActions(actions,group){this.groups[group.id]=actions;}}
 installHud({api:{ActionHandler,RollHandler:class{},SystemManager:class{}}});
 const handler=new hudSystem.api.SystemManager().getActionHandler();handler.actor={...actor,items:[magazine]};handler.groups={};
 await handler.buildSystemActions();assert.equal(handler.groups.other.length,0);
 await VitruviyActorSheet.onTogglePrepared.call(sheet,null,target);await handler.buildSystemActions();assert.equal(magazine.system.prepared,true);assert.deepEqual(handler.groups.other.map(action=>action.name),['Обойма']);assert.equal(magazine.system.quantity,2);
 await VitruviyActorSheet.onTogglePrepared.call({...sheet,isEditable:false},null,target);assert.equal(magazine.system.prepared,true);
 await VitruviyActorSheet.onTogglePrepared.call(sheet,null,target);await handler.buildSystemActions();assert.equal(handler.groups.other.length,0);assert.equal(magazine.system.quantity,2);
});
function responseSetup(defaultVisibility){
 setup();game.users=Object.assign([game.user,{id:'p',isGM:false}],{activeGM:game.user});game.settings.get=(_scope,key)=>key==='responseRollVisibility'?defaultVisibility:'public';
 const message={id:'attack',uuid:'ChatMessage.attack',getFlag:()=>({dealsDamage:true,targets:[{uuid:'Scene.s.Token.target'}]}),async update(){return this;}};
 globalThis.fromUuid=async uuid=>uuid==='Scene.s.Token.target'?{actor}:uuid===message.uuid?message:null;
 Roll.prototype.toJSON=function(){return {formula:this.formula};};return message;
}
test('one response form includes attribute, mode and visibility; Hidden overrides a Public world default',async()=>{
 const message=responseSetup('public');choice={attribute:'combat',mode:'advantage',rollMode:'gm'};
 await defend(actor,message);assert.equal(prompts.length,1);for(const name of ['attribute','mode','rollMode'])assert.ok(prompts[0].content.includes(`name="${name}"`));
 assert.match(prompts[0].content,/value="public" selected/);assert.deepEqual(actor.getFlag('vitruviy','defenses.attack'),{hidden:true});assert.deepEqual(messages[0].whisper,['gm']);assert.equal(messages[0].blind,true);assert.deepEqual(dice,['5d6','5d6']);
});
test('Public in the response form overrides a Hidden default and does not inherit parent message secrecy',async()=>{
 const message=responseSetup('gm');message.whisper=['gm'];message.blind=true;choice={attribute:'combat',mode:'normal',rollMode:'public'};
 await defend(actor,message);assert.equal(prompts.length,1);assert.match(prompts[0].content,/value="gm" selected/);assert.deepEqual(messages[0].whisper,[]);assert.equal(messages[0].blind,false);assert.equal(actor.getFlag('vitruviy','defenses.attack').total,5);
});
test('response cancellation or invalid visibility never rolls, posts or records a result',async()=>{
 const message=responseSetup('gm');choice=null;await defend(actor,message);assert.deepEqual(dice,[]);assert.equal(messages.length,0);
 choice={attribute:'combat',mode:'normal',rollMode:'invalid'};await assert.rejects(defend(actor,message),/InvalidCheck/);assert.deepEqual(dice,[]);assert.equal(actor.getFlag('vitruviy','defenses.attack'),undefined);
});
test('private dice placeholder uses WIND markup without touching hidden content, rolls or result flags',()=>{
 setup();const content={innerHTML:'native ???',querySelector:()=>null};const html={querySelector:selector=>selector==='.message-content'?content:null};
 const message={isRoll:true,isContentVisible:false,get content(){throw Error('Secret content read');},get rolls(){throw Error('Secret dice read');},get flags(){throw Error('Secret result flags read');}};
 styleHiddenRoll(message,html);assert.match(content.innerHTML,/vit-chat vit-hidden-roll/);assert.match(content.innerHTML,/VIT.HiddenRollTitle/);assert.ok(!content.innerHTML.includes('dice-formula'));assert.ok(!content.innerHTML.includes('dice-total'));
 const before=content.innerHTML;styleHiddenRoll({isRoll:true,isContentVisible:true},html);assert.equal(content.innerHTML,before);styleHiddenRoll({isRoll:false,isContentVisible:false},html);assert.equal(content.innerHTML,before);
});
test('public responses can choose base, attack or defense; selected bonuses and branch labels match',async()=>{
 for(const [branch,count,label]of [['base',3,'BaseAttribute'],['attack',4,'Attack'],['defense',5,'Defense']]){
  const message=responseSetup('public');choice={attribute:'combat',branch,mode:'normal',rollMode:'public'};await defend(actor,message);
  assert.equal(prompts.length,1);assert.match(prompts[0].content,/name="branch"/);assert.match(prompts[0].content,/value="defense" selected/);assert.deepEqual(dice,[`${count}d6`]);assert.equal(actor.getFlag('vitruviy','defenses.attack').branch,branch);assert.equal(messages[0].flags.vitruviy.response.result.total,count);assert.match(messages[0].content,new RegExp(`VIT.${label}`));
 }
});
test('hidden response uses the selected branch; invalid branch cannot roll or record anything',async()=>{
 const message=responseSetup('public');choice={attribute:'combat',branch:'attack',mode:'normal',rollMode:'gm'};await defend(actor,message);assert.deepEqual(dice,['4d6']);assert.deepEqual(actor.getFlag('vitruviy','defenses.attack'),{hidden:true});assert.equal(messages[0].flags.vitruviy.response.result.branch,'attack');
 const second=responseSetup('public');choice={attribute:'combat',branch:'invalid',mode:'normal',rollMode:'gm'};await assert.rejects(defend(actor,second),/InvalidCheck/);assert.deepEqual(dice,[]);assert.equal(messages.length,0);
});
test('GM transport computes a hidden base response rather than trusting client numbers or using defense bonus',async()=>{
 const message=responseSetup('public');game.users.get=id=>game.users.find(user=>user.id===id);actor.testUserPermission=()=>true;
 await processResourceRequest(actor,'branch-base',{kind:'defend',time:Date.now(),payload:{messageUuid:message.uuid,attribute:'combat',branch:'base',mode:'normal',visibility:'gm',result:{total:999}}},'p');
 assert.deepEqual(dice,['3d6']);assert.equal(messages[0].flags.vitruviy.response.result.total,3);assert.equal(messages[0].flags.vitruviy.response.result.branch,'base');assert.deepEqual(actor.getFlag('vitruviy','defenses.attack'),{hidden:true});
});
