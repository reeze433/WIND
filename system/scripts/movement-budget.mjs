export const DEFAULT_MOVEMENT=[0,8,10,12,13,14,15];
export function movementBand(cost,speed){return cost<=speed+1e-6?'normal':cost<=speed*2+1e-6?'run':'over';}
export function movementBudget(actor,units='m',table=DEFAULT_MOVEMENT){
  const attribute=Number(actor?.system.attributes.movement??0);
  const value=Number(table[Math.max(0,Math.min(6,Math.floor(attribute)))]??0);
  return ['ft','feet','фут','футы','футов'].includes(String(units).toLowerCase())?value/0.3048:value;
}
const COLORS={normal:0x35ab64,run:0xffa52b,over:0xe53c45};
export function installMovementRuler(){
  const Base=CONFIG.Token.rulerClass;
  CONFIG.Token.rulerClass=class WindMovementRuler extends Base{
    _windBand(waypoint){
      const speed=movementBudget(this.token.actor??this.token.document.actor,canvas.scene?.grid?.units??canvas.grid.units,game.settings.get('vitruviy','movementTable')??DEFAULT_MOVEMENT);
      return movementBand(waypoint.measurement?.cost??0,speed);
    }
    _windEnabled(){return game.settings.get('vitruviy','movementBudgetEnabled')!==false&&!!(this.token.actor??this.token.document.actor);}
    _shouldRenderWaypoint(waypoint){return super._shouldRenderWaypoint(waypoint)||(this._windEnabled()&&waypoint.previous&&this._windBand(waypoint)!==this._windBand(waypoint.previous));}
    _getGridHighlightStyle(waypoint,offset){const style=super._getGridHighlightStyle(waypoint,offset);return this._windEnabled()?{...style,color:COLORS[this._windBand(waypoint)]}:style;}
    _getSegmentStyle(waypoint){const style=super._getSegmentStyle(waypoint);return this._windEnabled()?{...style,color:COLORS[this._windBand(waypoint)]}:style;}
    _getWaypointStyle(waypoint){const style=super._getWaypointStyle(waypoint);return this._windEnabled()?{...style,color:COLORS[this._windBand(waypoint)]}:style;}
  };
}
