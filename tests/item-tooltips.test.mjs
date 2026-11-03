import test from 'node:test';import assert from 'node:assert/strict';
import {bindItemTooltips,ITEM_TOOLTIP_DELAY} from '../system/scripts/item-tooltips.mjs';
function fixture(){
 const first=new EventTarget(),second=new EventTarget();for(const element of [first,second]){element.isConnected=true;element.dataset={windTooltipHtml:'<p>Описание</p>'};}
 const calls=[];globalThis.game={tooltip:{element:null,clearPending(){},deactivate(){this.element=null;},activate(element,options){this.element=element;calls.push({element,options});}}};
 const sheet={element:{querySelectorAll:()=>[first,second]}};bindItemTooltips(sheet);return{first,second,sheet,calls};
}
test('item descriptions wait one second, including 500 ms beyond native Foundry delay',context=>{
 context.mock.timers.enable({apis:['setTimeout']});const {first,calls,sheet}=fixture();first.dispatchEvent(new Event('pointerenter'));context.mock.timers.tick(ITEM_TOOLTIP_DELAY-1);assert.equal(calls.length,0);context.mock.timers.tick(1);assert.equal(calls.length,1);assert.equal(calls[0].options.html,'<p>Описание</p>');sheet._windTooltipCleanup();
});
test('leaving, dragging and switching items cancel pending descriptions; rerender removes old listeners',context=>{
 context.mock.timers.enable({apis:['setTimeout']});const {first,second,calls,sheet}=fixture();
 first.dispatchEvent(new Event('pointerenter'));context.mock.timers.tick(600);first.dispatchEvent(new Event('pointerleave'));context.mock.timers.tick(1000);assert.equal(calls.length,0);
 first.dispatchEvent(new Event('pointerenter'));context.mock.timers.tick(500);second.dispatchEvent(new Event('pointerenter'));context.mock.timers.tick(500);assert.equal(calls.length,0);second.dispatchEvent(new Event('dragstart'));context.mock.timers.tick(1000);assert.equal(calls.length,0);
 bindItemTooltips(sheet);first.dispatchEvent(new Event('focus'));context.mock.timers.tick(1000);assert.equal(calls.length,1);sheet._windTooltipCleanup();first.dispatchEvent(new Event('pointerenter'));context.mock.timers.tick(1000);assert.equal(calls.length,1);
});
