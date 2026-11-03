import test from 'node:test';
import assert from 'node:assert/strict';
import {itemEditorText,itemTextHTML} from '../system/scripts/item-text.mjs';
import {checkHTML} from '../system/scripts/rolls.mjs';

test('legacy text keeps newlines, quotes and literal comparisons',()=>{
  assert.equal(itemEditorText('Первый\n>> Второй < 5'),'Первый<br>&gt;&gt; Второй &lt; 5');
  assert.equal(itemEditorText(null),'');
});
test('formatted descriptions use Foundry enrichment and public visibility',async()=>{
  const calls=[];
  globalThis.foundry={applications:{ux:{TextEditor:{enrichHTML:async(text,options)=>{calls.push({text,options});return text;}}}}};
  const item={uuid:'Item.test'};
  const html='<h3>Эффект</h3><p><strong>Успех</strong></p><ul><li>Бонус</li></ul>';
  assert.equal(await itemTextHTML(html,item),html);
  assert.deepEqual(calls[0],{text:html,options:{relativeTo:item,secrets:false}});
  await itemTextHTML(html,item,{secrets:true});assert.equal(calls[1].options.secrets,true);
});
test('roll cards preserve enriched markup while ordinary descriptions stay escaped',()=>{
  globalThis.game={i18n:{localize:x=>x}};
  const result={mode:'normal',total:1,attempts:[]};
  assert.match(checkHTML(result,'Item','',{descriptionHTML:'<p><b>Бонус</b></p>'}),/<p><b>Бонус<\/b><\/p>/);
  assert.match(checkHTML(result,'Item','',{description:'<b>raw</b>'}),/&lt;b&gt;raw&lt;\/b&gt;/);
});
