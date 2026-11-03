import test from 'node:test';import assert from 'node:assert/strict';
import {captureInspirationChange,announceInspirationChange,inspirationText,inspirationTemplates} from '../system/scripts/inspiration-chat.mjs';
import {activeInspirationRecipients,grantInspiration} from '../system/scripts/inspiration.mjs';
import {refreshResourceControls} from '../system/scripts/resources.mjs';
let messages,values,actor,player;
function setup(){
 messages=[];values={};actor={uuid:'Actor.a',name:'Hero <unsafe>',type:'character',system:{inspiration:{value:4}},async update(data){this.system.inspiration.value=data['system.inspiration.value'];return this;}};
 const gm={id:'gm',isGM:true,active:true,name:'GM',character:actor};player={id:'p',name:'Алексей',isGM:false,active:true,character:actor};const users=[gm,player,{id:'offline',active:false,character:actor},{id:'none',active:true}];users.get=id=>users.find(user=>user.id===id);
 globalThis.game={user:gm,users,settings:{get:(_s,key)=>values[key]},i18n:{localize:key=>key}};
 globalThis.ChatMessage={getSpeaker:()=>({}),create:async message=>{messages.push(message);return message;}};
 globalThis.foundry={utils:{flattenObject:object=>object},applications:{api:{DialogV2:{prompt:async()=>null}}}};globalThis.ui={notifications:{warn:()=>{},info:()=>{}}};
}
test('manual changes, gains and spends produce one escaped chat notice; unchanged and invalid edits do not',async()=>{
 setup();
 for(const [after,edit,kind] of [[9,true,'edit'],[6,false,'gain'],[2,false,'spend']]){
  const options={vitruviyInspirationEdit:edit};captureInspirationChange(actor,{'system.inspiration.value':after},options);assert.equal(options.vitruviyInspirationChange.kind,kind);await announceInspirationChange(actor,{},options,'gm');
 }
 assert.equal(messages.length,3);assert.match(messages[0].content,/4.*9/);assert.match(messages[0].content,/&lt;unsafe&gt;/);
 const same={};captureInspirationChange(actor,{'system.inspiration.value':4},same);await announceInspirationChange(actor,{},same,'gm');assert.equal(messages.length,3);
 assert.equal(captureInspirationChange(actor,{'system.inspiration.value':-1},{}),false);assert.equal(captureInspirationChange(actor,{'system.inspiration.value':1.5},{}),false);
});
test('item/check receipts suppress duplicates, rollback is silent, only initiating client posts',async()=>{
 setup();const event={kind:'spend',amount:1,before:4,after:3},options={vitruviyInspirationChange:event,vitruviyInspirationUseId:'use'};
 await announceInspirationChange(actor,{}, {...options,vitruviyItemMessageId:'item'},'gm');await announceInspirationChange(actor,{}, {...options,vitruviyInspirationSilent:true},'gm');await announceInspirationChange(actor,{},options,'other');assert.equal(messages.length,0);
 await announceInspirationChange(actor,{},options,'gm');assert.equal(messages.length,1);assert.equal(messages[0].flags.vitruviy.resource.refundOnly,true);
});
test('templates substitute supported fields and escape user text, with bounded validation',()=>{
 setup();values.inspirationMessages={gain:'[{Игрок} ({Пользователь}) заслужил своё {Вдохновение}] +{Количество}, {Было}/{Стало} <img>'};
 assert.equal(inspirationText(actor,{kind:'gain',before:4,after:6,userId:'p'}),'[Hero &lt;unsafe&gt; (Алексей) заслужил своё VIT.Inspiration] +2, 4/6 &lt;img&gt;');
 assert.throws(()=>inspirationTemplates({gain:''}),/InvalidInspirationTemplate/);assert.throws(()=>inspirationTemplates({edit:'x'.repeat(601)}));
});
test('only active non-GM users with a character are recipients, labels show character and user',async()=>{
 setup();assert.deepEqual(activeInspirationRecipients().map(entry=>entry.userId),['p']);let content;
 foundry.applications.api.DialogV2.prompt=async options=>{content=options.content;return {userId:'p',amount:'2'};};await grantInspiration();assert.equal(actor.system.inspiration.value,6);assert.match(content,/Hero &lt;unsafe&gt; \(Алексей\)/);assert.ok(!content.includes('offline'));
});
test('disconnect or reassignment while grant dialog is open prevents any write',async()=>{
 setup();foundry.applications.api.DialogV2.prompt=async()=>{player.active=false;return {userId:'p',amount:'2'};};await assert.rejects(grantInspiration(),/RecipientDisconnected/);assert.equal(actor.system.inspiration.value,4);
 player.active=true;foundry.applications.api.DialogV2.prompt=async()=>{player.character={...actor,uuid:'Actor.b'};return {userId:'p',amount:'2'};};await assert.rejects(grantInspiration(),/RecipientDisconnected/);assert.equal(actor.system.inspiration.value,4);
});
test('refresh of item refund buttons uses each card and does not repeat its inspiration receipt',()=>{
 setup();const status={};const card={querySelector:selector=>selector==='.vit-resource-status'?status:{}};
 const button={dataset:{actorUuid:actor.uuid,messageId:'m'},closest:()=>card};
 globalThis.document={querySelectorAll:()=>[button]};game.messages={get:()=>({getFlag:()=>({cost:1,useId:'use'})})};actor.getFlag=()=>true;
 refreshResourceControls(actor);assert.equal(status.hidden,true);assert.equal(button.disabled,false);assert.match(button.textContent,/Refund/);
});
