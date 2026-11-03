import test from 'node:test';import assert from 'node:assert/strict';
globalThis.Hooks={once:()=>{},callAll:(_name,data)=>{globalThis.hudApi=data.api;}};
const {installHud}=await import('../system/scripts/hud.mjs');
function setup(){
 const errors=[],warnings=[];globalThis.ui={notifications:{error:value=>errors.push(value),warn:value=>warnings.push(value)}};
 globalThis.game={i18n:{localize:key=>key},vitruviy:{rollItem:async()=>{throw Error('Недостаточно вдохновения для использования предмета или особенности.');}}};
 installHud({api:{ActionHandler:class{},RollHandler:class{},SystemManager:class{}}});
 const item={system:{prepared:true},sheet:{render:async()=>{}}},actor={isOwner:true,system:{inspiration:{value:0}},items:new Map([['ability',item]])};
 const handler=new (new hudApi.SystemManager().getRollHandler().constructor)();handler.actor=actor;handler.action={system:{actionType:'item',actionId:'ability'}};handler.isRenderItem=()=>false;
 return {handler,item,actor,errors,warnings};
}
test('HUD reports activation failure once and does not swallow the insufficient-inspiration notice',async()=>{
 const {handler,actor,errors}=setup();await handler.handleActionClick();assert.deepEqual(errors,['Недостаточно вдохновения для использования предмета или особенности.']);assert.equal(actor.system.inspiration.value,0);
 let used=0;game.vitruviy.rollItem=async()=>{used++;};await handler.handleActionClick();assert.equal(used,1);assert.equal(errors.length,1);
});
test('HUD keeps right-click inspection and unprepared-item warning separate from activation',async()=>{
 const {handler,item,errors,warnings}=setup();let rendered=0;item.sheet.render=async()=>{rendered++;};handler.isRenderItem=()=>true;await handler.handleActionClick();assert.equal(rendered,1);assert.equal(errors.length,0);
 handler.isRenderItem=()=>false;item.system.prepared=false;await handler.handleActionClick();assert.deepEqual(warnings,['VIT.ItemNotPrepared']);assert.equal(errors.length,0);
});
