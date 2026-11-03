import {panelGridLimit,usesCardGrid} from './card-defaults.mjs';
import {GRID_CATEGORIES,layoutCards,cardSize,intersects,validPosition,firstFree,gridViewportGeometry} from './card-grid.mjs';
import {categoryOf} from './cards.mjs';
import {t} from './rolls.mjs';

export function boardLayout(sheet,type){return sheet._windLayouts?.[type]??layoutCards(sheet.actor.items.filter(item=>categoryOf(item)===type),{columns:18,boundsColumns:panelGridLimit(type),limit:panelGridLimit(type)});}
export async function moveGridCard(sheet,item,type,position){
 if(!sheet.isEditable||!GRID_CATEGORIES.includes(type)||item.actor?.uuid!==sheet.actor.uuid)throw Error(t('NoPermission'));
 const board=boardLayout(sheet,type),size=cardSize(item,sheet._windCollapsed?.includes(type));
 if(!validPosition(position,size,gridBounds(board))||[...board.rects].some(([id,rect])=>id!==item.id&&intersects({...size,...position},rect)))throw Error(t('GridSpaceUnavailable'));
 const updates=[...board.rects].filter(([id])=>id!==item.id).map(([id,rect])=>({_id:id,'system.gridPosition':{x:rect.x,y:rect.y}}));
 const source=categoryOf(item);
 if(source!==type&&GRID_CATEGORIES.includes(source))for(const [id,rect] of boardLayout(sheet,source).rects)if(id!==item.id)updates.push({_id:id,'system.gridPosition':{x:rect.x,y:rect.y}});
 updates.push({_id:item.id,'system.category':type,'system.gridPosition':position});
 await sheet.actor.updateEmbeddedDocuments('Item',updates);
 const key=sheet.actor.uuid.replace(/\W/g,'_');await game.user.setFlag('vitruviy',`cardSort.${key}.${type}`,'manual');
 sheet.render(false);
}
export async function resizeGridItem(item,data,options={}){
 const actor=item.actor,sheet=actor.sheet,type=data.system?.category??categoryOf(item),source=categoryOf(item);
 const board=boardLayout(sheet,type),others=new Map([...board.rects].filter(([id])=>id!==item.id));
 const size=cardSize({system:{...item.system,...data.system}}),current=board.rects.get(item.id)??item.system.gridPosition;
 const position=validPosition(current,size,gridBounds(board))&&![...others.values()].some(rect=>intersects({...size,x:current.x,y:current.y},rect))?{x:current.x,y:current.y}:firstFree([...others.values()],size,gridBounds(board));
 if(source!==type&&GRID_CATEGORIES.includes(source))for(const [id,rect]of boardLayout(sheet,source).rects)if(id!==item.id)others.set(id,rect);
 const updates=[...others].map(([id,rect])=>({_id:id,'system.gridPosition':{x:rect.x,y:rect.y}}));
 updates.push({...data,_id:item.id,system:{...data.system,gridPosition:position}});
 await actor.updateEmbeddedDocuments('Item',updates,options);
 return {updated:item};
}
export async function toggleGridCard(sheet,target){
 if(!sheet.isEditable)return;
 const item=sheet.actor.items.get(target.closest('[data-item-id]').dataset.itemId),type=categoryOf(item);
 if(!GRID_CATEGORIES.includes(type))return;
 if(!usesCardGrid()){await item.update({'system.gridCollapsed':!item.system.gridCollapsed});return;}
 const layout=boardLayout(sheet,type),current=layout.rects.get(item.id),collapsed=!item.system.gridCollapsed;
 const size=cardSize({system:{...item.system,gridCollapsed:collapsed}}),others=[...layout.rects].filter(([id])=>id!==item.id);
 const position=validPosition(current,size,gridBounds(layout))&&!others.some(([,rect])=>intersects({...size,x:current.x,y:current.y},rect))?{x:current.x,y:current.y}:firstFree(others.map(([,rect])=>rect),size,gridBounds(layout));
 const updates=others.map(([id,rect])=>({_id:id,'system.gridPosition':{x:rect.x,y:rect.y}}));
 updates.push({_id:item.id,'system.gridCollapsed':collapsed,'system.gridPosition':position});
 await sheet.actor.updateEmbeddedDocuments('Item',updates);
}
const gridBounds=layout=>({columns:layout.boundsColumns??18,limit:layout.limit??512});
export function fitCardGrid(sheet,board){
 const viewport=board.parentElement,width=Math.max(0,viewport.clientWidth-16);if(!width)return;
 const type=board.dataset.gridType,layout=boardLayout(sheet,type),scale=Number(board.closest('[data-card-scale]').dataset.cardScale);
 sheet._windViewportWidths??={};sheet._windViewportWidths[type]=width;
 const geometry=gridViewportGeometry(width,scale,Number(board.dataset.gridLimit),[...layout.rects.values()]);
 const limit=Number(board.dataset.gridLimit);board.dataset.gridColumns=String(limit);board.style.setProperty('--wind-grid-columns',String(limit));board.style.setProperty('--wind-grid-rows',String(limit));
 layout.columns=geometry.columns;layout.rows=geometry.rows;
}
export function bindCardGrids(sheet){
 sheet._windGridObserver?.disconnect();for(const timer of sheet._windGridSaveTimers?.values()??[])clearTimeout(timer);sheet._windGridSaveTimers?.clear();
 const previousSizes=new WeakMap();sheet._windGridSaveTimers??=new Map();
 sheet._windGridObserver=new ResizeObserver(entries=>{
  for(const entry of entries){const viewport=entry.target,board=viewport.querySelector('.wind-grid,.wind-card-list');if(!board)continue;if(board.classList.contains('wind-grid'))fitCardGrid(sheet,board);
   const size={width:Math.round(viewport.getBoundingClientRect().width),height:Math.round(viewport.getBoundingClientRect().height)},previous=previousSizes.get(viewport);previousSizes.set(viewport,size);
   if(!previous||!size.width||!size.height||size.width===previous.width&&size.height===previous.height)continue;
   const type=board.dataset.gridType??board.dataset.listType;clearTimeout(sheet._windGridSaveTimers.get(type));
   sheet._windGridSaveTimers.set(type,setTimeout(()=>{const actorKey=sheet.actor.uuid.replace(/\W/g,'_');game.user.setFlag('vitruviy',`cardGridSizes.${actorKey}.${type}`,size).catch(error=>ui.notifications.error(error.message));sheet._windGridSaveTimers.delete(type);},250));
  }
 });
 for(const board of sheet.element.querySelectorAll('.wind-grid,.wind-card-list')){if(board.classList.contains('wind-grid'))fitCardGrid(sheet,board);sheet._windGridObserver.observe(board.parentElement);}
 for(const card of sheet.element.querySelectorAll('.wind-grid-overflow [data-item-id]'))card.addEventListener('dragstart',event=>{const item=sheet.actor.items.get(card.dataset.itemId);if(!sheet.isEditable||!item){event.preventDefault();return;}event.dataTransfer.setData('text/plain',JSON.stringify({type:'Item',uuid:item.uuid}));sheet._windDragOffset={x:0,y:0};});
 const key=sheet.actor.uuid.replace(/\W/g,'_');
 for(const slider of sheet.element.querySelectorAll('[data-grid-opacity]')){
  const board=slider.closest('.vit-panel').querySelector('.wind-grid');
  slider.addEventListener('input',event=>{event.stopPropagation();board.style.setProperty('--wind-grid-opacity',String(Number(slider.value)/100));});
  slider.addEventListener('change',event=>{event.stopPropagation();game.user.setFlag('vitruviy',`cardGridOpacity.${key}.${slider.dataset.gridOpacity}`,Number(slider.value)).catch(error=>ui.notifications.error(error.message));});
 }
 if(!sheet.isEditable)return;
 for(const list of sheet.element.querySelectorAll('.wind-card-list')){
  list.addEventListener('dragover',event=>{event.preventDefault();event.stopPropagation();});
  list.addEventListener('drop',async event=>{event.preventDefault();event.stopImmediatePropagation();try{
   const data=foundry.applications.ux.TextEditor.getDragEventData(event);if(data.type!=='Item')return;
   const item=await fromUuid(data.uuid),type=list.dataset.listType;if(!item)throw Error(t('NoPermission'));
   if(item.actor?.uuid===sheet.actor.uuid){
    if(event.target.closest('[data-item-id]'))await sheet._onSortItem(event,item);
    else {await item.update({'system.category':type});await sheet.setCardSort(type,'manual');}
   }else{
    if(!item.testUserPermission(game.user,'OBSERVER'))throw Error(t('NoPermission'));
    const source=item.toObject();delete source._id;source.system.category=type;source.system.gridPosition={x:-1,y:-1};await sheet.actor.createEmbeddedDocuments('Item',[source]);
   }
  }catch(error){ui.notifications.warn(error.message);}});
 }
 for(const board of sheet.element.querySelectorAll('.wind-grid')){
  board.addEventListener('dragstart',event=>{
   const card=event.target.closest('[data-item-id]');if(!card)return;
   const item=sheet.actor.items.get(card.dataset.itemId);if(!item)return;
   event.dataTransfer.setData('text/plain',JSON.stringify({type:'Item',uuid:item.uuid}));
   const box=card.getBoundingClientRect(),cell=board.getBoundingClientRect().width/Number(board.dataset.gridColumns);
   sheet._windDragOffset={x:Math.floor((event.clientX-box.left)/cell),y:Math.floor((event.clientY-box.top)/cell)};
  });
  board.addEventListener('dragover',event=>{event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='move';});
  board.addEventListener('drop',async event=>{
   event.preventDefault();event.stopImmediatePropagation();
   try{
    const data=foundry.applications.ux.TextEditor.getDragEventData(event);if(data.type!=='Item')return;
    const item=await fromUuid(data.uuid);if(!item)throw Error(t('NoPermission'));
    const box=board.getBoundingClientRect(),cell=box.width/Number(board.dataset.gridColumns);
    const offset=item.actor?.uuid===sheet.actor.uuid?(sheet._windDragOffset??{x:0,y:0}):{x:0,y:0};
    const position={x:Math.floor((event.clientX-box.left)/cell)-offset.x,y:Math.floor((event.clientY-box.top)/cell)-offset.y};
    const type=board.dataset.gridType;
    if(item.actor?.uuid===sheet.actor.uuid)await moveGridCard(sheet,item,type,position);
    else{
     if(!item.testUserPermission(game.user,'OBSERVER'))throw Error(t('NoPermission'));
     const size=cardSize(item,sheet._windCollapsed?.includes(type)),layout=boardLayout(sheet,type);
     if(!validPosition(position,size,gridBounds(layout))||[...layout.rects.values()].some(rect=>intersects({...size,...position},rect)))throw Error(t('GridSpaceUnavailable'));
     const source=item.toObject();delete source._id;source.system.category=type;source.system.gridPosition=position;
     const updates=[...layout.rects].map(([id,rect])=>({_id:id,'system.gridPosition':{x:rect.x,y:rect.y}}));
     if(updates.length)await sheet.actor.updateEmbeddedDocuments('Item',updates);
     await sheet.actor.createEmbeddedDocuments('Item',[source]);
    }
   }catch(error){ui.notifications.warn(error.message);}finally{sheet._windDragOffset=null;}
  });
 }
}
