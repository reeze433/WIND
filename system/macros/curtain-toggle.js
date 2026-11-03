if (!game.user.isGM) return;
const macro = game.macros.find(entry => entry.getFlag('vitruviy', 'curtainToggle') === true);
if (!macro || macro._windCurtainBusy) return;
macro._windCurtainBusy = true;
try {
  const module = game.modules.get('scene-transitions');
  if (!module?.active || !module.api?.macro) throw Error('Модуль Scene Transitions не включён.');
  const hidden = !(macro.getFlag('vitruviy', 'curtainHidden') ?? true);
  const users = game.users.filter(user => !user.isGM && user.active).map(user => user.id);

  const options = hidden ? {action: 'end', users} : {
    sceneID: false, activateScene: false, content: '', bgImg: '', bgColor: '#000000',
    bgOpacity: 1, fadeIn: 500, fadeOut: 500, delay: 86400000,
    allowPlayersToEnd: false, gmHide: true, showUI: false, audio: '', users
  };
  if (users.length) await module.api.macro(options, false);
  await macro.update({name: `Ширма скрыта: ${hidden ? 'ON' : 'OFF'}`,
    img: hidden ? 'icons/svg/eye.svg' : 'icons/svg/blind.svg',
    'flags.vitruviy.curtainHidden': hidden});
  ui.notifications.info(hidden ? 'Ширма скрыта: ON' : 'Ширма скрыта: OFF');
} catch (error) {
  ui.notifications.error(error.message);
} finally {
  macro._windCurtainBusy = false;
}
