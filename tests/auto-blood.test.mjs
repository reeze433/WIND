import test from 'node:test';import assert from 'node:assert/strict';
import {registerAutoBlood,toggleAutoBlood,refreshAutoBloodMacro,autoBloodMacroState,maybeSpawnBlood} from '../system/scripts/auto-blood.mjs';
import {applyDamage} from '../system/scripts/damage.mjs';
import {macroDefinitions} from '../system/scripts/macros.mjs';
let enabled,notifications,filesRead,tiles,actor,other,docs,values,scene,macro,registration;
function setup(){
 enabled=false;notifications=[];filesRead=0;tiles=[];docs=new Map();registration=null;
 const gm={id:'gm',isGM:true,getFlag:()=>({size:1})};
 macro={name:'old',img:'old',getFlag:(_s,key)=>key==='libraryMacro'?'auto-blood':null,async update(data){Object.assign(this,data);return this;}};
 globalThis.game={user:gm,users:{activeGM:gm},macros:[macro],i18n:{localize:key=>key},settings:{get:(_s,key)=>key==='autoBlood'?enabled:key==='customResourceCount'?0:'public',register:(_s,_k,data)=>registration=data,async set(_s,key,value){assert.equal(key,'autoBlood');enabled=value;await registration?.onChange?.(value);return value;}}};
 globalThis.ui={notifications:{info:text=>notifications.push(['info',text]),warn:text=>notifications.push(['warn',text]),error:text=>notifications.push(['error',text])}};
 globalThis.ChatMessage={create:async()=>{throw Error('Unexpected chat message');}};
 globalThis.foundry={applications:{apps:{FilePicker:{implementation:{browse:async(_source,path)=>{assert.equal(path,'assets/CODE RED/moulinette_assets/blood');filesRead++;return {files:['blood.png','ignore.jpg']};}}}},api:{DialogV2:{prompt:async()=>values}}},canvas:{loadTexture:async path=>{assert.equal(path,'blood.png');return {width:200,height:100};}}};
 scene={id:'s',uuid:'Scene.s',grid:{size:100},async createEmbeddedDocuments(type,data){assert.equal(type,'Tile');tiles.push(...data);return data.map((d,i)=>({...d,id:String(i),uuid:'Scene.s.Tile.'+i}));}};
 actor={uuid:'Actor.a',id:'a',type:'character',isOwner:true,name:'A',system:{health:{value:10,max:20}},flags:{},getFlag(_s,key){return this.flags[key]},async update(data){if('system.health.value'in data)this.system.health.value=data['system.health.value'];for(const[k,v]of Object.entries(data))if(k.startsWith('flags.vitruviy.'))this.flags[k.slice(15)]=v;return this;}};
 other={...actor,uuid:'Actor.b',id:'b',name:'B',system:{health:{value:10,max:20}},flags:{}};
 for(const [id,a,x]of [['one',actor,100],['two',actor,400],['enemy',other,700]]){const token={uuid:'Scene.s.Token.'+id,actor:a,parent:scene,x,y:200,width:2,height:1};docs.set(token.uuid,token);}
 globalThis.fromUuid=async uuid=>docs.get(uuid);globalThis.canvas={tokens:{controlled:[]}};
 values={target0:'on',amount:'3',mode:'damage'};
}
function message(targets=['one']){return {id:'m',uuid:'ChatMessage.m',getFlag:(_s,k)=>k==='item'?{dealsDamage:true,potentialDamage:3,targets:targets.map(id=>({uuid:'Scene.s.Token.'+id,name:id}))}:k==='check'?{total:2}:null};}
test('toggle defaults off, is GM-only and sends only brief local notifications, never chat',async()=>{
 setup();registerAutoBlood();assert.equal(registration.default,false);assert.equal(registration.scope,'world');assert.equal(registration.config,false);
 assert.equal(await toggleAutoBlood(),true);assert.equal(enabled,true);assert.equal(macro.name,'VIT.AutoBloodMacroOn');assert.equal(await toggleAutoBlood(),false);assert.equal(macro.name,'VIT.AutoBloodMacroOff');assert.deepEqual(notifications,[['info','VIT.AutoBloodEnabled'],['info','VIT.AutoBloodDisabled']]);
 game.user.isGM=false;await assert.rejects(toggleAutoBlood(),/NoPermission/);assert.equal(enabled,false);assert.equal(notifications.length,2);
});
test('rapid double toggle cannot race; completed subsequent click toggles normally',async()=>{
 setup();let release;game.settings.set=async(_s,_k,v)=>{await new Promise(resolve=>release=resolve);enabled=v;};const first=toggleAutoBlood();await toggleAutoBlood();release();await first;assert.equal(enabled,true);assert.equal(notifications.length,1);game.settings.set=async(_s,_k,v)=>enabled=v;await toggleAutoBlood();assert.equal(enabled,false);
});
test('macro has two visible states and GM-only library definition',()=>{
 setup();const off=autoBloodMacroState();enabled=true;const on=autoBloodMacroState();assert.notEqual(off.name,on.name);assert.notEqual(off.img,on.img);const definition=macroDefinitions().find(d=>d.id==='auto-blood');assert.equal(definition.gm,true);assert.match(definition.command,/toggleAutoBlood/);assert.ok(!definition.command.includes('ChatMessage'));
});
test('other GM or player clients never update macro or receive state notifications',async()=>{
 setup();game.users.activeGM={id:'other'};enabled=true;await refreshAutoBloodMacro();assert.equal(macro.name,'old');assert.deepEqual(notifications,[]);
});
test('off, healing, zero damage and player calls do not read assets or spawn tiles',async()=>{
 setup();const args={mode:'damage',amount:3,tokenUuids:['Scene.s.Token.one']};await maybeSpawnBlood(actor,args);enabled=true;await maybeSpawnBlood(actor,{...args,mode:'healing'});await maybeSpawnBlood(actor,{...args,amount:0});game.user.isGM=false;await maybeSpawnBlood(actor,args);assert.equal(filesRead,0);assert.deepEqual(tiles,[]);
});
test('blood uses only selected damaged tokens, is visible and centred with PNG aspect ratio',async()=>{
 setup();enabled=true;await maybeSpawnBlood(actor,{mode:'damage',amount:3,tokenUuids:['Scene.s.Token.one','Scene.s.Token.enemy','Scene.s.Token.one']});assert.equal(tiles.length,1);assert.equal(filesRead,1);assert.equal(tiles[0].x,200);assert.equal(tiles[0].y,250);assert.equal(tiles[0].width,100);assert.equal(tiles[0].height,50);assert.equal(tiles[0].hidden,false);assert.deepEqual(tiles[0].texture,{src:'blood.png',anchorX:.5,anchorY:.5});assert.equal(tiles[0].flags.vitruviy.sourceTokenUuid,'Scene.s.Token.one');
});
test('damage to selected linked tokens is applied once to actor and blood appears under each selected token',async()=>{
 setup();enabled=true;values={target0:'on',target1:'on',amount:'3',mode:'damage'};await applyDamage(message(['one','two']));assert.equal(actor.system.health.value,7);assert.equal(tiles.length,2);assert.deepEqual(tiles.map(t=>t.x),[200,500]);assert.equal(filesRead,1);
});
test('per-target x0 and healing never produce blood; unselected enemy never gets a tile',async()=>{
 setup();enabled=true;values={target0:'on',target1:'on',amount:'3',mode:'damage',multiplier0:'1',multiplier1:'0'};await applyDamage(message(['one','enemy']));assert.equal(actor.system.health.value,7);assert.equal(other.system.health.value,10);assert.equal(tiles.length,1);tiles.length=0;values.mode='healing';await applyDamage(message(['one','enemy']));assert.equal(tiles.length,0);
});
test('damage applied while disabled changes HP without any blood; already-zero HP does not create blood',async()=>{
 setup();await applyDamage(message());assert.equal(actor.system.health.value,7);assert.equal(filesRead,0);enabled=true;actor.system.health.value=0;await applyDamage(message());assert.equal(tiles.length,0);assert.equal(filesRead,0);
});
test('tile failure cannot roll back or reject committed damage; only GM gets a warning',async()=>{
 setup();enabled=true;scene.createEmbeddedDocuments=async()=>{throw Error('disk unavailable');};const log=console.error;console.error=()=>{};try{await applyDamage(message());}finally{console.error=log;}assert.equal(actor.system.health.value,7);assert.equal(notifications.filter(n=>n[0]==='warn').length,1);assert.match(notifications.find(n=>n[0]==='warn')[1],/AutoBloodFailed/);
});
test('switching off during image loading prevents later tile creation',async()=>{
 setup();enabled=true;foundry.canvas.loadTexture=async()=>{enabled=false;return {width:100,height:100};};await maybeSpawnBlood(actor,{mode:'damage',amount:3,tokenUuids:['Scene.s.Token.one']});assert.equal(tiles.length,0);
});
test('missing or foreign token does not fall back to all active actor tokens',async()=>{
 setup();enabled=true;actor.getActiveTokens=()=>{throw Error('Must not guess another token');};await maybeSpawnBlood(actor,{mode:'damage',amount:3,tokenUuids:['deleted','Scene.s.Token.enemy']});assert.equal(filesRead,0);assert.equal(tiles.length,0);
});
