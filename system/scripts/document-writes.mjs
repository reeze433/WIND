function read(document,path){
  let value=document._source??document;
  for(const part of path.split('.'))value=value?.[part];
  if(value===undefined&&path.startsWith('flags.')&&document.getFlag){const [,scope,...key]=path.split('.');value=document.getFlag(scope,key.join('.'));}
  return value;
}
function equalPatch(actual,expected){
  if(expected&&typeof expected==='object'&&!Array.isArray(expected))return !!actual&&Object.entries(expected).every(([key,value])=>equalPatch(actual[key],value));
  if(Array.isArray(expected))return Array.isArray(actual)&&actual.length===expected.length&&expected.every((value,index)=>equalPatch(actual[index],value));
  return Object.is(actual,expected);
}
export function updateAlreadyApplied(document,changes){
  return Object.keys(changes).length>0&&Object.entries(changes).every(([key,value])=>{
    if(key==='_id')return (document.id??document._id)===value;
    const parts=key.split('.');if(parts.at(-1).startsWith('-=')){parts[parts.length-1]=parts.at(-1).slice(2);return read(document,parts.join('.'))===undefined;}
    return equalPatch(read(document,key),value);
  });
}
// Foundry can cancel a write, or omit it because the exact requested state already exists.
export async function checkedUpdate(document, changes, options = {}) {
  if(updateAlreadyApplied(document,changes))return document;
  const result = await document.update(changes, options);
  if (!result&&!updateAlreadyApplied(document,changes)) throw new Error(game.i18n.localize('VIT.UpdateCancelled'));
  return result??document;
}

export async function checkedEmbeddedUpdate(actor, type, updates) {
  const get=id=>actor.getEmbeddedDocument?.(type,id)??(type==='Item'?actor.items?.get(id):null);
  const pending=updates.filter(update=>{const document=get(update._id);return !document||!updateAlreadyApplied(document,update);});
  if(!pending.length)return updates.map(update=>get(update._id));
  const result = await actor.updateEmbeddedDocuments(type, pending);
  const ids = new Set((result ?? []).map(document => document.id));
  if (pending.some(update => !ids.has(update._id)&&(!get(update._id)||!updateAlreadyApplied(get(update._id),update))))
    throw new Error(game.i18n.localize('VIT.UpdateCancelled'));
  return result;
}
