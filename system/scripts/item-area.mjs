import {checkedUpdate} from './document-writes.mjs';
import {t} from './rolls.mjs';
import {resourceOperation,registerResourceAction} from './operations.mjs';

export const AREA_SHAPES=['circle','cone','line','rectangle'];
export function areaSettings(system){
 if(!system.areaEnabled)return null;
 const placement=system.areaPlacement??'point';
 if(!['point','self'].includes(placement))throw Error(t('InvalidCheck'));
 const shape=system.areaShape??'circle',size=Number(system.areaSize??1),width=Number(system.areaWidth??1),angle=Number(system.areaAngle??90);
 if(!AREA_SHAPES.includes(shape)||!Number.isFinite(size)||size<.1||size>1000||!Number.isFinite(width)||width<.1||width>1000||!Number.isFinite(angle)||angle<1||angle>360)throw Error(t('InvalidCheck'));
 return {shape,size,width,angle,placement};
}
export function areaPixels(scene){
 const units=String(scene.grid.units??'').trim().toLowerCase();
 const feet=['ft','feet','foot','фут','футы','футов'].includes(units);
 if(!feet&&!['m','meter','meters','metre','metres','м','метр','метра','метров','zone','zones','зона','зоны','зон'].includes(units))throw Error(t('AreaUnitsUnknown'));
 const ratio=Number(scene.grid.size)/Number(scene.grid.distance)*(feet?1/.3048:1);
 if(!Number.isFinite(ratio)||ratio<=0)throw Error(t('InvalidCheck'));
 return ratio;
}
export function areaShapeData(area,scene,point,direction=0){
 const settings=areaSettings({areaEnabled:true,areaShape:area.shape,areaSize:area.size,areaWidth:area.width,areaAngle:area.angle});
 const scale=areaPixels(scene),x=Number(point.x),y=Number(point.y);
 if(![x,y,direction].every(Number.isFinite))throw Error(t('InvalidCheck'));
 const base={type:settings.shape,x,y,gridBased:false};
 if(settings.shape==='circle')return {...base,radius:settings.size*scale};
 if(settings.shape==='cone')return {...base,radius:settings.size*scale,angle:settings.angle,rotation:direction,curvature:'round'};
 if(settings.shape==='line')return {...base,length:settings.size*scale,width:settings.width*scale,rotation:direction};
 return {...base,width:settings.size*scale,height:settings.width*scale,anchorX:0,anchorY:.5,rotation:direction};
}
export function areaRegionData(area,scene,point,direction,{name,userId,color='#ee3333',messageUuid,itemUuid}={}){
 const shape=areaShapeData(area,scene,point,direction);if(area.placement==='self'&&shape.type==='rectangle')shape.anchorX=.5;
 return {name,color,shapes:[shape],ownership:{default:0,[userId]:3},visibility:2,highlightMode:'coverage',displayMeasurements:true,restriction:{enabled:false,type:'move',priority:0},behaviors:[],flags:{vitruviy:{area:true,messageUuid,itemUuid}}};
}
let placing=false;
export async function createAreaRegion(actor,message,scene,placement,user=game.user){
 const item=message?.getFlag('vitruviy','item');
 const source=item?.uuid?await fromUuid(item.uuid):null;
 if(!item?.area||source?.actor?.uuid!==actor.uuid||(!user.isGM&&message.author?.id!==user.id)||!scene||(!user.isGM&&user.viewedScene!==scene.id&&!scene.testUserPermission(user,'OBSERVER')))throw Error(t('NoPermission'));
 const created=await scene.createEmbeddedDocuments('Region',[areaRegionData(item.area,scene,placement.point,placement.direction,{name:item.name,userId:user.id,color:user.color?.css??'#ee3333',messageUuid:message.uuid,itemUuid:item.uuid})]);
 if(!created?.length)throw Error(t('UpdateCancelled'));
 return created[0];
}
registerResourceAction('placeArea',async(actor,payload,user)=>createAreaRegion(actor,await fromUuid(payload.messageUuid),await fromUuid(payload.sceneUuid),payload.placement,user));
export async function placeItemArea(message){
 if(placing)return;
 const item=message?.getFlag('vitruviy','item'),area=item?.area;
 if(!message?.visible||!area)throw Error(t('NoPermission'));
 if(!game.user.isGM&&message.author?.id!==game.user.id)throw Error(t('NoPermission'));
 if(!canvas.ready||!canvas.scene)throw Error(t('AreaNeedsScene'));
 const source=await fromUuid(item.uuid),actor=source?.actor;
 if(!actor?.isOwner)throw Error(t('NoPermission'));
 if(!game.user.can('REGION_CREATE')&&!game.users.activeGM)throw Error(t('ResourceNeedsGM'));
 areaShapeData(area,canvas.scene,{x:0,y:0});
 placing=true;
 let graphics;
 try{
  const scene=canvas.scene,point={x:0,y:0};let direction=0,moved=false;
  graphics=new PIXI.Graphics();graphics.eventMode='none';canvas.stage.addChild(graphics);
  const paint=()=>{
   const shape=areaShapeData(area,scene,point,direction),radians=direction*Math.PI/180;
   graphics.clear();graphics.lineStyle(2,0xff4444,.95).beginFill(0xee3333,.22);
   if(shape.type==='circle')graphics.drawCircle(point.x,point.y,shape.radius);
   else{
    let points=[];
    const rotate=(x,y)=>[point.x+x*Math.cos(radians)-y*Math.sin(radians),point.y+x*Math.sin(radians)+y*Math.cos(radians)];
    if(shape.type==='cone'){
     points=[point.x,point.y];const steps=Math.max(8,Math.ceil(shape.angle/5));
     for(let i=0;i<=steps;i++){const angle=(-shape.angle/2+shape.angle*i/steps)*Math.PI/180;points.push(...rotate(shape.radius*Math.cos(angle),shape.radius*Math.sin(angle)));}
    }else{const length=shape.length??shape.width,width=shape.type==='line'?shape.width:shape.height;points=[...rotate(0,-width/2),...rotate(length,-width/2),...rotate(length,width/2),...rotate(0,width/2)];}
    graphics.drawPolygon(points);
   }
   graphics.endFill();
  };
  ui.notifications.info(t('AreaPlacementHint'));
  const placement=await new Promise(resolve=>{
   const view=canvas.app.view;let done=false;
   const finish=value=>{if(done)return;done=true;canvas.stage.off('pointermove',move);view.removeEventListener('pointerdown',click,true);view.removeEventListener('contextmenu',cancel);view.removeEventListener('wheel',wheel,true);window.removeEventListener('keydown',key,true);Hooks.off('canvasTearDown',hook);resolve(value);};
   const move=event=>{const position=snapAreaPoint(event.getLocalPosition(canvas.stage));point.x=position.x;point.y=position.y;moved=true;paint();};
   const click=event=>{if(![0,2].includes(event.button))return;event.preventDefault();event.stopImmediatePropagation();if(event.button===2)finish(null);else if(moved)finish({point:{...point},direction});};
   const cancel=event=>{event.preventDefault();finish(null);};
   const wheel=event=>{event.preventDefault();event.stopImmediatePropagation();direction=(direction+Math.sign(event.deltaY)*(event.shiftKey?15:5)+360)%360;if(moved)paint();};
   const key=event=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();finish(null);}};
   const hook=Hooks.on('canvasTearDown',()=>finish(null));
   canvas.stage.on('pointermove',move);view.addEventListener('pointerdown',click,true);view.addEventListener('contextmenu',cancel);view.addEventListener('wheel',wheel,{capture:true,passive:false});window.addEventListener('keydown',key,true);
  });
  if(!placement||canvas.scene!==scene)return null;
  if(game.user.can('REGION_CREATE'))return await createAreaRegion(actor,message,scene,placement);
  return await resourceOperation(actor,'placeArea',{messageUuid:message.uuid,sceneUuid:scene.uuid,placement},()=>createAreaRegion(actor,message,scene,placement));
 }finally{graphics?.destroy();placing=false;}
}
export function addAreaControls(message,html){
 if(message.getFlag('vitruviy','item')?.area?.placement==='self')return;
 if(!message.visible||!message.getFlag('vitruviy','item')?.area||(!game.user.isGM&&message.author?.id!==game.user.id))return;
 const card=html.querySelector('.vit-chat');if(!card||card.querySelector('.vit-place-area'))return;
 const button=document.createElement('button');button.type='button';button.className='vit-place-area';button.textContent=t('PlaceArea');
 button.addEventListener('click',async()=>{button.disabled=true;try{await placeItemArea(message);}catch(error){ui.notifications.error(error.message);}finally{button.disabled=false;}});card.append(button);
}

export function snapAreaPoint(point){const grid=canvas.grid;if(!grid||grid.isGridless)return {...point};const M=CONST.GRID_SNAPPING_MODES;return grid.getSnappedPoint(point,{mode:M.CENTER|M.VERTEX|M.EDGE_MIDPOINT,resolution:1});}


export function selfAreaTokenUuid(actor){
 const own=token=>(token.actor?.uuid===actor.uuid),doc=token=>token.document??token;
 if(actor.token&&(!globalThis.canvas?.scene||actor.token.parent?.id===canvas.scene.id))return actor.token.uuid;
 const selected=(globalThis.canvas?.tokens?.controlled??[]).filter(own);
 if(selected.length===1)return doc(selected[0]).uuid;
 if(selected.length>1)throw Error(t('SelfAreaChooseToken'));
 const tokens=(globalThis.canvas?.tokens?.placeables??[]).filter(own);
 if(tokens.length!==1)throw Error(t(tokens.length?'SelfAreaChooseToken':'SelfAreaNeedsToken'));
 return doc(tokens[0]).uuid;
}
export async function validateSelfArea(actor,tokenUuid,user=game.user){
 const token=tokenUuid?await fromUuid(tokenUuid):null,scene=token?.parent;
 if(!token||token.actor?.uuid!==actor.uuid||!scene||(!user.isGM&&user.viewedScene!==scene.id))throw Error(t('SelfAreaNeedsToken'));
 areaPixels(scene);
 const scale=scene.grid.size,point={x:Number(token.x)+Number(token.width)*scale/2,y:Number(token.y)+Number(token.height)*scale/2},direction=Number(token.rotation??0);
 if(![point.x,point.y,direction].every(Number.isFinite))throw Error(t('InvalidCheck'));
 return {scene,point,direction};
}
export async function createActivationArea(actor,message,tokenUuid,user=game.user){
 const {scene,point,direction}=await validateSelfArea(actor,tokenUuid,user);
 let region;
 try{
  region=await createAreaRegion(actor,message,scene,{point,direction},user);
  const receipt=`<p class="vit-area-receipt">${t('SelfAreaCreated')}</p>`;
  await checkedUpdate(message,{'flags.vitruviy.areaRegionUuid':region.uuid,'flags.vitruviy.areaReceipt':receipt,content:message.content.replace('</article>',`${receipt}</article>`)});
  return region;
 }catch(error){if(region)try{await region.delete();}catch(cleanupError){console.error(cleanupError);ui.notifications.error(t('ResourceRollbackFailed'));}throw error;}
}
