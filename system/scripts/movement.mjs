// Foundry 14 native grid measurement; no separate ruler approximation.
export const MOVEMENT_UNITS = {feet:{units:'ft'},metres:{units:'m'},zones:{units:'зона'}};
export function movementGrid(mode) {
  if (!Object.hasOwn(MOVEMENT_UNITS,mode)) throw new RangeError('Invalid movement units');
  return {...MOVEMENT_UNITS[mode]};
}
export async function applyMovementUnits(mode) {
  if (game.user.id !== game.users.activeGM?.id) return;
  const grid=movementGrid(mode);
  for (const scene of game.scenes) await scene.update({'grid.units':grid.units});
}
export function registerMovementSettings() {
  game.settings.register('vitruviy','movementUnits',{name:'VIT.MovementUnits',hint:'VIT.MovementUnitsHint',scope:'world',config:false,type:String,choices:{feet:'VIT.MovementFeet',metres:'VIT.MovementMetres',zones:'VIT.MovementZones'},default:'zones',onChange:mode=>applyMovementUnits(mode).catch(console.error)});
  Hooks.on('preCreateScene',scene=>{
    const grid=movementGrid(game.settings.get('vitruviy','movementUnits'));
    scene.updateSource({'grid.units':grid.units});
  });
}
