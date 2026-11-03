import test from 'node:test';import assert from 'node:assert/strict';
import {healthPreview,bindValueSummary} from '../system/scripts/damage.mjs';
import {bindResponsePools} from '../system/scripts/targets.mjs';
globalThis.game={i18n:{localize:key=>key}};
test('health forecast clamps at zero and maximum for damage and healing',()=>{assert.equal(healthPreview(12,20,5,'damage'),7);assert.equal(healthPreview(12,20,50,'damage'),0);assert.equal(healthPreview(12,20,50,'healing'),20);});
test('summary updates active count, operation, HP forecast and disables empty confirmation',()=>{
 const events={},button={},amount={value:'4',form:{querySelector:()=>button}},mode={value:'damage'},output={dataset:{targetHealth:'0',hp:'12',max:'20'}},panel={querySelectorAll:()=>Array(count).fill({})};let count=2;
 const root={querySelector:selector=>selector==='[name="amount"]'?amount:selector==='[name="mode"]'?mode:selector.startsWith('[role=')?panel:{value:'.5'},querySelectorAll:()=>[output],addEventListener:(name,fn)=>events[name]=fn};
 bindValueSummary(root);assert.match(button.textContent,/\(2\)/);assert.equal(output.textContent,'12 → 10');assert.equal(button.disabled,false);
 mode.value='healing';events.change();assert.equal(output.textContent,'12 → 14');assert.match(button.textContent,/Healing/);
 count=0;events.click();assert.equal(button.disabled,true);
});
test('response pools update after attribute or branch changes',()=>{
 const attribute={value:'combat'},branch={value:'defense',options:['base','attack','defense'].map(value=>({value}))},output={},events={};
 const actor={system:{attributes:{combat:3,thinking:4},attackBonuses:{combat:2},defenseBonuses:{combat:1}}};
 bindResponsePools({querySelector:s=>s.includes('attribute')?attribute:s.includes('branch')?branch:output,addEventListener:(e,fn)=>events[e]=fn},actor);
 assert.match(output.textContent,/4$/);assert.match(branch.options[1].textContent,/\(5\)/);
 attribute.value='thinking';branch.value='base';events.change();assert.match(output.textContent,/4$/);assert.match(branch.options[1].textContent,/\(4\)/);
});
