import {t} from './rolls.mjs';
let placing=false;
export const BLOOD_FOLDER='assets/CODE RED/moulinette_assets/blood';
export function pngFiles(files){return files.filter(path=>/\.png(?:[?#].*)?$/i.test(path));}
export async function bloodPngFiles(){
 const picker=foundry.applications.apps.FilePicker.implementation;
 const files=pngFiles((await picker.browse('data',BLOOD_FOLDER)).files);
 if(!files.length)throw Error(t('TileNoFiles'));
 return files;
}
export async function bloodTileData(scene,point,{files,size=Number(game.user.getFlag('vitruviy','randomTile')?.size??1)}={}){
 if(!game.user.isGM)throw Error(t('NoPermission'));
 if(!Number.isFinite(size)||size<.1||size>100||![point.x,point.y].every(Number.isFinite))throw Error(t('InvalidCheck'));
 files??=await bloodPngFiles();
 const src=files[Math.floor(Math.random()*files.length)];
 const texture=await foundry.canvas.loadTexture(src),grid=Number(scene.grid?.size??globalThis.canvas?.grid?.size);
 if(!texture||![texture.width,texture.height,grid].every(value=>Number.isFinite(value)&&value>0))throw Error(t('TileInvalidImage'));
 const width=size*grid,height=width*texture.height/texture.width;
 return {hidden:true,texture:{src,anchorX:0.5,anchorY:0.5},x:point.x,y:point.y,width,height};
}
export async function randomTile(){
 if(!game.user.isGM)throw Error(t('NoPermission'));
 if(placing)return;
 if(!canvas.ready||!canvas.scene)throw Error(t('AreaNeedsScene'));
 const scene=canvas.scene,point={x:canvas.mousePosition.x,y:canvas.mousePosition.y};
 if(!Number.isFinite(point.x)||!Number.isFinite(point.y))throw Error(t('InvalidCheck'));
 placing=true;
 try{
  const data=await bloodTileData(scene,point);
  if(canvas.scene!==scene)return;
  const created=await scene.createEmbeddedDocuments('Tile',[data]);
  if(created?.length)ui.notifications.info(`${t('TileCreated')}: ${data.texture.src.split('/').at(-1)}`);
  return created;
 }catch(error){if(error.message===t('TileNoFiles'))return ui.notifications.warn(error.message);throw error;}
 finally{placing=false;}
}
