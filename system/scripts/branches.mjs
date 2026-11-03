export function attributePool(actor,attribute,branch='base'){
  if(!['base','attack','defense'].includes(branch))throw new Error('Invalid branch');
  const base=Number(actor.system.attributes[attribute]??0);
  if(branch==='base')return base;
  const bonus=Number(actor.system[`${branch}Bonuses`]?.[attribute]??0);
  return Math.min(100,Math.max(0,base+bonus));
}
