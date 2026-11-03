export function upgradeHudLayout(layout,customName='Кастом'){
 const updated=structuredClone(layout);
 for(const group of Object.values(updated))if(group.id==='ability')for(const field of ['name','listName'])if(group[field]==='Способности')group[field]='Особенности';
 if(updated.ability&&updated.ability_actions&&!updated.custom&&!updated.custom_actions){
  const order=Number(updated.ability.order)+1;
  for(const group of Object.values(updated))if(group.level===1&&Number(group.order)>=order)group.order=Number(group.order)+1;
  updated.custom={...structuredClone(updated.ability),id:'custom',name:customName,listName:customName,order};
  updated.custom_actions={...structuredClone(updated.ability_actions),id:'custom',name:customName,listName:customName};
 }
 return updated;
}
