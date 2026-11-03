export const ITEM_TOOLTIP_DELAY=1000;
export function bindItemTooltips(sheet){
 sheet._windTooltipCleanup?.();
 let timer=null,active=null;const listeners=[];
 const clear=()=>{if(timer!==null)clearTimeout(timer);timer=null;};
 for(const element of sheet.element.querySelectorAll('[data-wind-tooltip-html]')){
  const enter=()=>{clear();active=element;game.tooltip.clearPending();game.tooltip.deactivate();timer=setTimeout(()=>{timer=null;if(active===element&&element.isConnected)game.tooltip.activate(element,{html:element.dataset.windTooltipHtml,cssClass:'vit-item-tooltip'});},ITEM_TOOLTIP_DELAY);};
  const leave=()=>{if(active===element){clear();active=null;}if(game.tooltip.element===element)game.tooltip.deactivate();};
  for(const event of ['pointerenter','focus']){element.addEventListener(event,enter);listeners.push([element,event,enter]);}
  for(const event of ['pointerleave','blur','pointerdown','dragstart']){element.addEventListener(event,leave);listeners.push([element,event,leave]);}
 }
 sheet._windTooltipCleanup=()=>{clear();if(active&&game.tooltip.element===active)game.tooltip.deactivate();active=null;for(const [element,event,listener]of listeners)element.removeEventListener(event,listener);};
}
