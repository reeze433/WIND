import test from 'node:test';
import assert from 'node:assert/strict';
import {installTokenFonts,refreshTokenFonts} from '../system/scripts/token-fonts.mjs';

let theme='cyberpunk',preset='theme',loads=[];
const flags=[];
globalThis.game={settings:{get:(_scope,key)=>key==='theme'?theme:preset}};
globalThis.document={fonts:{load:async spec=>{loads.push(spec);return [{}];}}};
globalThis.canvas={tokens:{placeables:[{renderFlags:{set:flag=>flags.push(flag)}}]}};
const hooks=[];
const original={fontFamily:'Signika',fontSize:24,fill:'#fff',stroke:'#111',wordWrapWidth:250};
class BaseToken{_getTextStyle(){return {...original};}}
globalThis.CONFIG={Token:{objectClass:BaseToken}};
globalThis.Hooks={on:(name,callback)=>hooks.push({name,callback})};

test('canvas fonts follow theme and explicit choices, preserving native styles',async()=>{
  installTokenFonts();const Token=CONFIG.Token.objectClass;installTokenFonts();
  assert.equal(CONFIG.Token.objectClass,Token);assert.equal(hooks.length,1);
  assert.equal(hooks[0].name,'canvasReady');
  const token=new Token();assert.deepEqual(token._getTextStyle(),original);
  await refreshTokenFonts();
  assert.equal(token._getTextStyle().fontFamily,'Wind Russo One');
  assert.equal(token._getTextStyle().fontSize,24);assert.equal(token._getTextStyle().wordWrapWidth,250);
  assert.equal(token._getTextStyle().fontWeight,'400');assert.equal(original.fontFamily,'Signika');
  assert.match(loads[0],/Wind Russo One/);assert.deepEqual(flags.at(-1),{refreshNameplate:true,refreshTooltip:true});
  theme='starwars';await hooks[0].callback();assert.equal(token._getTextStyle().fontFamily,'Wind Exo 2');
  preset='russoone';await refreshTokenFonts();assert.equal(token._getTextStyle().fontFamily,'Wind Russo One');
  preset='standard';await refreshTokenFonts();assert.deepEqual(token._getTextStyle(),original);
});

test('late font loads cannot overwrite a newer choice',async()=>{
  let finish;
  document.fonts.load=()=>new Promise(resolve=>{finish=resolve;});
  preset='exo2';const pending=refreshTokenFonts();
  assert.equal(new CONFIG.Token.objectClass()._getTextStyle().fontFamily,'Signika');
  preset='standard';await refreshTokenFonts();finish([{}]);await pending;
  assert.equal(new CONFIG.Token.objectClass()._getTextStyle().fontFamily,'Signika');
});

test('failed font load leaves native font intact; canvas need not exist',async()=>{
  document.fonts.load=async()=>[];preset='exo2';
  await assert.rejects(refreshTokenFonts(),/font not loaded/);
  assert.equal(new CONFIG.Token.objectClass()._getTextStyle().fontFamily,'Signika');
  preset='standard';delete globalThis.canvas;await refreshTokenFonts();
});
