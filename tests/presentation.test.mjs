import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCurrencies,headerBackground,headerImageURL,validHeaderImage,DEFAULT_HEADER_BACKGROUNDS} from '../system/scripts/presentation.mjs';
import {checkHTML} from '../system/scripts/rolls.mjs';
let id=0;
globalThis.foundry={utils:{randomID:()=>`new${++id}`}};
globalThis.game={i18n:{localize:key=>key}};
test('header follows theme; custom images and disabled backgrounds are supported',()=>{
 assert.equal(headerBackground('starwars'),DEFAULT_HEADER_BACKGROUNDS.starwars);
 assert.equal(headerBackground('cyberpunk'),DEFAULT_HEADER_BACKGROUNDS.cyberpunk);
 assert.equal(headerBackground('standard'),'');
 assert.equal(headerBackground('cyberpunk',{cyberpunk:'worlds/test/Фон RED.webp'}),'worlds/test/Фон RED.webp');
 assert.equal(headerBackground('starwars',{starwars:''}),'');
 assert.equal(headerImageURL(DEFAULT_HEADER_BACKGROUNDS.cyberpunk,'http://localhost:30001/game'),'http://localhost:30001/systems/vitruviy/assets/header-code-red.jpg');
 assert.equal(headerImageURL('systems/vitruviy/assets/header-starwars.jpg','https://example.com/foundry/game'),'https://example.com/foundry/systems/vitruviy/assets/header-starwars.jpg');
 for(const path of ['javascript:test.jpg','data:image/png,test.png','file:///C:/x.jpg','x"bad.jpg','bad\n.png']) assert.equal(validHeaderImage(path),false);
});
test('renaming and reordering currencies preserve identity; additions never share a balance',()=>{
 const before=[{id:'a',name:'Credits'},{id:'b',name:'Cash'}];
 assert.deepEqual(parseCurrencies('Credits\nEurobucks',before),[{id:'a',name:'Credits'},{id:'b',name:'Eurobucks'}]);
 assert.deepEqual(parseCurrencies('Cash\nCredits',before),[{id:'b',name:'Cash'},{id:'a',name:'Credits'}]);
 const added=parseCurrencies('New\nCredits',before);assert.notEqual(added[0].id,'a');assert.equal(added[1].id,'a');
 assert.throws(()=>parseCurrencies('Cash\nCash',before));assert.throws(()=>parseCurrencies('a\nb\nc\nd\ne\nf\ng',before));
});
test('check card has title mode, pure dice and final successes; item includes public text and right-side damage math',()=>{
 const result={mode:'normal',pool:4,repeats:0,difficulty:null,total:4,selected:0,attempts:[{faces:[4,4,4,4],symbols:[1,1,1,1],total:4}]};
 const html=checkHTML(result,'Сражение');assert.ok(html.includes('Сражение |'));assert.ok(!html.includes('VIT.Repeats'));assert.ok(!html.includes('VIT.Pool'));
 const item=checkHTML(result,'Sniper','',{description:'Public <test>',damage:12,modifier:3,tier:'B'});
 assert.ok(item.includes('Public &lt;test&gt;'));assert.ok(item.includes('(4 × 3;'));assert.ok(item.indexOf('VIT.Successes')<item.indexOf('VIT.Value'));assert.ok(!item.includes('VIT.Damage:'));
 const noTier=checkHTML(result,'Item','',{damage:12,modifier:3,tier:'B',hasTier:false});
 assert.ok(noTier.includes('(4 × 3)'));assert.ok(!noTier.includes('VIT.Tier'));
});

