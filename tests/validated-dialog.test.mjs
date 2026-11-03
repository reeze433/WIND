import test from 'node:test';
import assert from 'node:assert/strict';
import {validatedDialog} from '../system/scripts/validated-dialog.mjs';
test('a validation or update failure keeps the dialog and values, displays an error and restores button states',async()=>{
 let closed=false;const button={disabled:false},previousDisabled={disabled:true},error={hidden:true,textContent:''},field={value:'bad formula'};
 globalThis.foundry={applications:{api:{DialogV2:class{
  async _onSubmit(){button.disabled=true;previousDisabled.disabled=true;if(field.value==='bad formula')throw Error('invalid');closed=true;return this;}
 }}}};
 const Dialog=validatedDialog(),dialog=new Dialog();
 dialog.element={querySelectorAll:()=>[button,previousDisabled],querySelector:()=>error};
 await dialog._onSubmit({},{});
 assert.equal(closed,false);assert.equal(field.value,'bad formula');assert.equal(button.disabled,false);assert.equal(previousDisabled.disabled,true);assert.equal(error.textContent,'invalid');assert.equal(error.hidden,false);
 field.value='24';await dialog._onSubmit({},{});assert.equal(closed,true);
});
