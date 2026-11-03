export const keys=['wellbeing','attention','movement','combat','thinking','communication'];
export function sideOf(actor){
  const seen=new Set(); let f=actor.folder;
  while(f&&!seen.has(f.id)){seen.add(f.id);const n=f.name.trim().toLocaleLowerCase('ru');if(n==='враги')return 1;if(n==='игроки'||n==='союзники')return 0;f=f.folder;}
  return null;
}
export function rng(seed){return ()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
export function distribution(n){let p=[1];for(let i=0;i<n;i++){const q=Array(p.length+2).fill(0);p.forEach((v,j)=>{q[j]+=v/2;q[j+1]+=v/3;q[j+2]+=v/6;});p=q;}return p;}
export function dpr(a,b){const p=distribution(a.attack),q=distribution(b.defense);return p.reduce((s,v,i)=>s+v*q.slice(0,i).reduce((x,y)=>x+y,0)*Math.max(0,i*a.modifier-b.armor),0);}
export function interval(w,n){const z=1.96,p=w/n,d=1+z*z/n,c=(p+z*z/(2*n))/d,h=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;return [Math.max(0,c-h),Math.min(1,c+h)];}
export function category(p){return p>=.98?'Лёгкий':p>=.95?'Средний':p>=.8?'Тяжёлый':p>=.5?'Почти смертельный':'Неблагоприятный';}
export function check(n,random){let s=0;for(let i=0;i<n;i++){const f=1+Math.floor(random()*6);s+=f===6?2:f>=4?1:0;}return s;}
export function battle(roster,initiative,random){
  const units=roster.map(u=>({...u}));const order=units.map(u=>({u,score:check(u.stats[initiative],random),tie:random()})).sort((a,b)=>b.score-a.score||b.tie-a.tie).map(x=>x.u);
  const alive=s=>units.filter(u=>u.side===s&&u.hp>0);
  for(let round=1;round<=100;round++)for(const u of order){
    if(!alive(0).length||!alive(1).length)return {winner:alive(0).length?0:1,round};
    if(u.hp<=0)continue;const targets=alive(1-u.side),v=targets[Math.floor(random()*targets.length)];
    const attack=check(u.attack,random),defense=check(v.defense,random);if(attack>defense)v.hp-=Math.max(0,attack*u.modifier-v.armor);
  }
  return {winner:!alive(1).length?0:!alive(0).length?1:null,round:100};
}
export function estimate(roster,initiative='combat',n=10000,seed=20261008){
  if(!keys.includes(initiative)||!Number.isInteger(n)||n<1||n>100000)throw Error('Некорректные параметры');
  if(![0,1].every(s=>roster.some(u=>u.side===s&&u.hp>0)))throw Error('Нужны живые участники обеих сторон');
  for(const u of roster){for(const k of ['hp','attack','defense','modifier','armor'])if(!Number.isFinite(u[k])||u[k]<0)throw Error('Некорректное число '+u.name);if(!Number.isInteger(u.attack)||!Number.isInteger(u.defense)||u.attack>100||u.defense>100)throw Error('Пул вне пределов');if(!Number.isInteger(u.stats[initiative])||u.stats[initiative]<0||u.stats[initiative]>100)throw Error('Некорректная инициатива');}
  const random=rng(seed);let wins=0,draws=0,rounds=0;for(let i=0;i<n;i++){const r=battle(roster,initiative,random);wins+=r.winner===0;draws+=r.winner===null;rounds+=r.round;}
  return {n,wins,draws,p:wins/n,interval:interval(wins,n),rounds:rounds/n,category:category(wins/n),seed};
}
