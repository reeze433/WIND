export const GRID_COLUMNS=18,GRID_LIMIT=512;
export const GRID_CATEGORIES=['ability','equipment','custom'];
export function cardSize(item,collapsed=false){return collapsed||item.system.gridCollapsed?{w:1,h:1}:{w:[3,4,5].includes(item.system.gridWidth)?item.system.gridWidth:3,h:6};}
export function intersects(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
export function validPosition(position,size,{columns=GRID_COLUMNS,limit=GRID_LIMIT}={}){return Number.isInteger(position?.x)&&Number.isInteger(position?.y)&&position.x>=0&&position.y>=0&&position.x+size.w<=columns&&position.y+size.h<=limit;}
export function firstFree(occupied,size,{columns=GRID_COLUMNS,limit=GRID_LIMIT}={}){
 if(!Number.isInteger(size.w)||!Number.isInteger(size.h)||size.w<1||size.h<1||size.w>columns||size.h>limit)throw Error('Grid full');
 for(let y=0;y<=limit-size.h;){
  const active=occupied.filter(rect=>rect.y<y+size.h&&rect.y+rect.h>y&&rect.x<columns&&rect.x+rect.w>0).sort((a,b)=>a.x-b.x);
  let x=0;
  for(const rect of active){if(x+size.w<=rect.x)return {x,y};x=Math.max(x,rect.x+rect.w);if(x+size.w>columns)break;}
  if(x+size.w<=columns)return {x,y};
  y=Math.min(...active.map(rect=>rect.y+rect.h));
 }
 throw Error('Grid full');
}
export function layoutCards(items,{collapsed=false,manual=true,columns=GRID_COLUMNS,limit=GRID_LIMIT,boundsColumns=columns,minRows=12}={}){
 const occupied=[],rects=new Map(),overflow=new Set(),bounds={columns:boundsColumns,limit};
 if(manual)for(const item of items){const size=cardSize(item,collapsed),position=item.system.gridPosition;
  if(validPosition(position,size,bounds)&&!occupied.some(rect=>intersects({...size,...position},rect))){const rect={...size,x:position.x,y:position.y};occupied.push(rect);rects.set(item.id,rect);}}
 for(const item of items)if(!rects.has(item.id)){const size=cardSize(item,collapsed);let position;try{position=firstFree(occupied,size,{columns,limit});}catch{try{position=firstFree(occupied,size,bounds);}catch{overflow.add(item.id);continue;}}const rect={...size,...position};occupied.push(rect);rects.set(item.id,rect);}
 return {rects,overflow,columns:Math.min(boundsColumns,Math.max(columns,...occupied.map(rect=>rect.x+rect.w))),boundsColumns,limit,rows:Math.min(limit,Math.max(minRows,...occupied.map(rect=>rect.y+rect.h+6)))};
}
export function placeCard(items,item,position,options={}){
 const layout=layoutCards(items,options),size=cardSize(item,options.collapsed);
 if(!validPosition(position,size,{columns:options.boundsColumns??options.columns??GRID_COLUMNS,limit:options.limit??GRID_LIMIT}))throw Error('Grid bounds');
 if([...layout.rects].some(([id,rect])=>id!==item.id&&intersects({...size,...position},rect)))throw Error('Grid occupied');
 return {x:position.x,y:position.y};
}

// Only rectangle metadata and CSS tracks are allocated, never a matrix of cells.
export function gridViewportGeometry(width,scale=1,limit=64,rects=[]){
 const cell=48*Math.min(1.5,Math.max(.6,Number.isFinite(scale)?scale:1));
 const columns=Math.min(limit,Math.max(5,Math.floor(Math.max(0,width)/cell),...rects.map(rect=>rect.x+rect.w)));
 const rows=Math.min(limit,Math.max(Math.ceil(576/cell),...rects.map(rect=>rect.y+rect.h+6)));
 return {columns,rows,cell};
}
