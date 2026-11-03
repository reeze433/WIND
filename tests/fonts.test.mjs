import test from 'node:test';import assert from 'node:assert/strict';
import {resolveFontPreset,FONT_PRESETS} from '../system/scripts/fonts.mjs';
test('theme defaults and explicit choices are global but independent of palette',()=>{
 assert.equal(resolveFontPreset('standard'),'standard');assert.equal(resolveFontPreset('starwars'),'exo2');assert.equal(resolveFontPreset('cyberpunk'),'russoone');
 for(const theme of ['standard','starwars','cyberpunk'])for(const preset of FONT_PRESETS.filter(p=>p!=='theme'))assert.equal(resolveFontPreset(theme,preset),preset);
 assert.equal(resolveFontPreset('cyberpunk','invalid'),'russoone');assert.equal(resolveFontPreset('unknown'),'standard');
});
