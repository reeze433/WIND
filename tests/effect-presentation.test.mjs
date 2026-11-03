import test from 'node:test';
import assert from 'node:assert/strict';
import {effectPresentation} from '../system/scripts/effect-presentation.mjs';
globalThis.game={i18n:{localize:key=>key}};
test('generated effect text is not duplicated and the actual modifier remains authoritative after an edit',()=>{
 const effect={description:'<p>VIT.combat: +1</p>',getFlag:()=>true,system:{changes:[{key:'system.attributes.combat',type:'add',value:2}]}};
 const view=effectPresentation(effect);assert.equal(view.description,'');assert.deepEqual(view.changes,[{label:'VIT.combat',value:'+2'}]);
});
test('manual effect descriptions remain visible',()=>{
 const description='<p>Боевой стимулятор. Действует до снятия.</p>';
 assert.equal(effectPresentation({description,getFlag:()=>true,system:{changes:[]}}).description,description);
});
