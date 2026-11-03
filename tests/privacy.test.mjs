import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const core=process.env.FOUNDRY_APP_PATH?readFileSync(`${process.env.FOUNDRY_APP_PATH}/common/abstract/document.mjs`,'utf8'):'';
const methods=['getUserLevel','testUserPermission'].map(name=>core.slice(core.indexOf(`  ${name}(`),core.indexOf('\n  /* ---------------------------------------- */',core.indexOf(`  ${name}(`))).trim());
const permissions=core?runInNewContext(`({${methods.join(',')}})`,{DOCUMENT_OWNERSHIP_LEVELS:{INHERIT:-1,NONE:0,LIMITED:1,OBSERVER:2,OWNER:3}}):{};
class Sheet{_canRender(){if(!this.actor.testUserPermission(game.user,'LIMITED'))throw Error('private');}}
globalThis.foundry={applications:{api:{ApplicationV2:class{},HandlebarsApplicationMixin:b=>b},sheets:{ActorSheetV2:Sheet,ItemSheetV2:Sheet}}};
globalThis.game={user:null,i18n:{localize:x=>x}};
const {VitruviyActorSheet,publishCard}=await import('../system/scripts/sheets.mjs');
const a={id:'A'},b={id:'B'},gm={id:'GM',isGM:true};
function actor(owner){return {type:'character',ownership:{default:0,[owner.id]:3},schema:{has:()=>true},...permissions};}
function open(document,user){game.user=user;const s=Object.create(VitruviyActorSheet.prototype);s.actor=document;return s._canRender({});}
test('A opens only A; B opens only B; GM opens both, with installed Foundry14 permission methods',{skip:!core},()=>{
 const aa=actor(a),bb=actor(b);open(aa,a);open(bb,b);assert.throws(()=>open(aa,b));assert.throws(()=>open(bb,a));open(aa,gm);open(bb,gm);
 aa.ownership.B=2;assert.throws(()=>open(aa,b));
 const embedded={parent:bb,schema:{has:()=>false},...permissions};assert.equal(embedded.testUserPermission(a,'OWNER'),false);assert.equal(embedded.testUserPermission(b,'OWNER'),true);
});
test('publishing public description excludes private text and metadata',async()=>{
 let message;globalThis.ChatMessage={getSpeaker:()=>({}),applyMode:()=>{},create:async data=>message=data};
 await publishCard({isOwner:true,name:'Item',type:'equipment',system:{tier:'B',quantity:1,description:'<p><strong>Public</strong></p>',privateDescription:'PRIVATE SENTINEL'}});
 assert.match(message.content,/<p><strong>Public<\/strong><\/p>/);assert.ok(!JSON.stringify(message).includes('PRIVATE SENTINEL'));
});

foundry.applications.ux={TextEditor:{enrichHTML:async text=>text}};
