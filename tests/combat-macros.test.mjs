import test from 'node:test';
import assert from 'node:assert/strict';
const notices=[];
globalThis.ui={notifications:Object.fromEntries(['warn','info','error'].map(k=>[k,message=>notices.push(message)]))};
globalThis.game={user:{isGM:true},combats:{viewed:null},i18n:{localize:k=>k}};
globalThis.canvas={scene:{id:'scene'},tokens:{controlled:[]}};
const {combatAction,macroAction,macroDefinitions}=await import('../system/scripts/macros.mjs');
function encounter(entries=[]){
  const combatants=entries;Object.defineProperty(combatants,'size',{get:()=>combatants.length});
  return {combatants,started:false,rolls:[],async rollInitiative(ids){this.rolls.push(ids);for(const c of combatants)if(ids.includes(c.id))c.initiative=0;},async startCombat(){this.started=true;this.starts=(this.starts??0)+1;},async nextTurn(){this.next=(this.next??0)+1;},async endCombat(){this.ended=true;}};
}
test('queue initiative preserves zero and existing values; second click does not reroll',async()=>{
  const c=encounter([{id:'zero',initiative:0},{id:'fixed',initiative:5},{id:'missing',initiative:null},{id:'new'}]);game.combats.viewed=c;
  await combatAction('initiative');await combatAction('initiative');
  assert.deepEqual(c.rolls,[['missing','new']]);assert.equal(c.combatants[1].initiative,5);
});
test('Roll initiative library macro rolls all missing participants as GM, independent of selection',async()=>{
  const c=encounter([{id:'first',initiative:null},{id:'second',initiative:null},{id:'zero',initiative:0},{id:'fixed',initiative:7}]);
  game.user.isGM=true;game.combats.viewed=c;canvas.tokens.controlled=[];
  await macroAction('initiative');await macroAction('initiative');
  assert.deepEqual(c.rolls,[['first','second']]);assert.equal(c.combatants[3].initiative,7);
});
test('player initiative macro only rolls their character and preserves announced zero',async()=>{
  const actor={uuid:'Actor.player',isOwner:true};
  const c=encounter([{id:'own',actor,initiative:null},{id:'other',actor:{uuid:'Actor.other'},initiative:null}]);
  game.user.isGM=false;game.combats.viewed=c;canvas.tokens.controlled=[{actor}];
  try {await macroAction('initiative');await macroAction('initiative');assert.deepEqual(c.rolls,[['own']]);}
  finally {game.user.isGM=true;canvas.tokens.controlled=[];}
});
test('adding tokens creates an encounter and never duplicates participants',async()=>{
  game.combats.viewed=null;let created,added=[];const c=encounter();
  globalThis.CONFIG={Combat:{documentClass:{create:async data=>{created=data;game.combats.viewed=c;return c;}}},Token:{documentClass:{createCombatants:async(tokens,{combat})=>{added.push(tokens.map(t=>t.id));for(const t of tokens)combat.combatants.push({tokenId:t.id,sceneId:t.parent.id});}}}};
  canvas.tokens.controlled=[{document:{id:'token',parent:{id:'scene'},actor:{}}},{document:{id:'no-actor',parent:{id:'scene'}}}];
  await combatAction('add');await combatAction('add');
  assert.deepEqual(created,{active:true,scene:'scene'});assert.deepEqual(added,[['token']]);assert.equal(c.combatants.length,1);
});
test('next starts a prepared encounter, then advances; end delegates standard confirmation',async()=>{
  const c=encounter([{id:'a'}]);game.combats.viewed=c;
  await combatAction('next');await combatAction('next');await combatAction('end');
  assert.equal(c.starts,1);assert.equal(c.next,1);assert.equal(c.ended,true);
});
test('player and empty encounter cannot advance; all three remaining library controls are GM only',async()=>{
  const c=encounter([{id:'a'}]);game.combats.viewed=c;game.user.isGM=false;
  await combatAction('next');assert.equal(c.started,false);game.user.isGM=true;
  game.combats.viewed=encounter();await combatAction('next');assert.equal(game.combats.viewed.started,false);
  const macros=macroDefinitions().filter(m=>m.id.startsWith('combat-'));assert.equal(macros.length,3);assert.ok(macros.every(m=>m.gm));
});
test('rapid repeated clicks cannot advance two turns while first update is pending',async()=>{
  const c=encounter([{id:'a'}]);c.started=true;let finish;let calls=0;
  c.nextTurn=()=>{calls++;return new Promise(resolve=>finish=resolve);};game.combats.viewed=c;
  const first=combatAction('next');await combatAction('next');assert.equal(calls,1);finish();await first;
});

