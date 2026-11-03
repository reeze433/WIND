import test from 'node:test';import assert from 'node:assert/strict';
import {movementGrid,applyMovementUnits} from '../system/scripts/movement.mjs';
test('three movement scales',()=>{
 assert.deepEqual(movementGrid('feet'),{units:'ft'});assert.deepEqual(movementGrid('metres'),{units:'m'});assert.deepEqual(movementGrid('zones'),{units:'зона'});
 assert.throws(()=>movementGrid('unknown'));
});
test('only active GM changes scene scales without touching native diagonals',async()=>{
 let writes=0;
 const scene={grid:{isSquare:true,diagonals:0},async update(data){this.changed=data;writes++;}};
 globalThis.game={user:{id:'gm'},users:{activeGM:{id:'gm'}},scenes:[scene]};
 await applyMovementUnits('metres');assert.deepEqual(scene.changed,{'grid.units':'m'});
 game.user.id='player';const before=writes;await applyMovementUnits('feet');assert.equal(writes,before);assert.equal(scene.grid.diagonals,0);
});
