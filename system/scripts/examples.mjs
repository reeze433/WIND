export function branchExamples(){return [
  {id:'combat-defense',name:'Пример — Тактический щит',img:'icons/svg/shield.svg',system:{category:'equipment',description:'<p>При использовании повышает только Защиту Сражения на 1. Базовое Сражение и Атака Сражения не изменяются. Снимите эффект, чтобы убрать бонус.</p>',hasTier:false,effectEnabled:true,effectName:'Тактический щит',effectTarget:'self',effectAttribute:'combat',effectBranch:'defense',effectBonus:1}},
  {id:'thinking-attack',name:'Пример — Боевой сопроцессор',img:'icons/svg/brain.svg',system:{category:'equipment',description:'<p>При использовании повышает только Атаку Мышления на 1. Базовое Мышление и его Защита не изменяются. Снимите эффект, чтобы убрать бонус.</p>',hasTier:false,effectEnabled:true,effectName:'Боевой сопроцессор',effectTarget:'self',effectAttribute:'thinking',effectBranch:'attack',effectBonus:1}}
];}
export async function ensureBranchExamples(){
  if(!game.user.isGM||game.users.activeGM?.id!==game.user.id)return;
  const missing=branchExamples().filter(example=>!game.items.some(item=>item.getFlag('vitruviy','branchExample')===example.id));if(!missing.length)return;
  let folder=game.folders.find(folder=>folder.type==='Item'&&folder.getFlag('vitruviy','branchExamples'));
  folder??=await Folder.create({name:'Wind — Примеры',type:'Item',flags:{vitruviy:{branchExamples:true}}});
  await Item.createDocuments(missing.map(({id,...data})=>({...data,type:'card',folder:folder.id,ownership:{default:2},flags:{vitruviy:{branchExample:id}}})));
}
