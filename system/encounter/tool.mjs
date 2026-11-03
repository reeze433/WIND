import {keys,sideOf,estimate,dpr,category,interval} from './core.mjs?v=1';
const names=['Самочувствие','Внимание','Движение','Сражение','Мышление','Общение'];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tiers={E:0,D:1,C:2,B:3,A:4,S:5};
export function snapshot(actor,side,id=actor.uuid){
 const weapons=actor.items.filter(i=>i.system.rollEnabled&&i.system.dealsDamage&&(!i.system.inspirationEnabled||i.system.cost===0));
 const weapon=weapons.sort((a,b)=>tiers[b.system.tier]-tiers[a.system.tier])[0];
 return {id,name:actor.name,side,hp:Number(actor.system.health.value),stats:{...actor.system.attributes},attack:Number(actor.system.attributes[weapon?.system.attribute??'combat']),defense:Number(actor.system.attributes.combat),modifier:weapon?Number(tiers[weapon.system.tier]):0,armor:0,weapon:weapon?.name??'Нет бесплатного оружия: задайте модификатор',warning:actor.items.some(i=>i.system.category==='ability')?'Свободные эффекты способностей не моделируются':''};
}
export function report(roster,r,initiative){
 const pct=p=>(p*100).toFixed(2)+'%';
 return `<h2>WIND · Сложность столкновения</h2><p><b>${r.category}</b> · шанс победы игроков и союзников: <b>${pct(r.p)}</b> (95% интервал ${r.interval.map(pct).join('–')}).</p><p>Инициатива: ${names[keys.indexOf(initiative)]}. ${r.n} симуляций; ничьи по лимиту 100 раундов: ${r.draws}; средняя длительность: ${r.rounds.toFixed(1)} раунда.</p><table><thead><tr><th>Участник</th><th>Сторона</th><th>HP</th><th>Атака / защита</th><th>Модификатор</th><th>DPR*</th></tr></thead><tbody>${roster.map(u=>{const opponents=roster.filter(v=>v.side!==u.side);return `<tr><td>${esc(u.name)}</td><td>${u.side?'Враги':'Игроки и союзники'}</td><td>${u.hp}</td><td>${u.attack} / ${u.defense}</td><td>${u.modifier}</td><td>${(opponents.reduce((s,v)=>s+dpr(u,v),0)/opponents.length).toFixed(2)}</td></tr>`;}).join('')}</tbody></table><p>*Ожидаемый урон одного действия против случайного живого противника на старте. Одна атака за ход, обычные броски, встречное Сражение, ничья без урона. При победе: все успехи × модификатор, затем вычет указанной защиты от урона.</p><p><b>Условная оценка обычного боя.</b> Вдохновение, лечение, контроль, массовые атаки, текстовые эффекты критов, укрытия и дистанция не включены. Сравните с руководством и поправьте сцену вручную. Никакие ресурсы и очередь боя не изменены.</p>`;
}
export async function run(){
 if(!game.user.isGM)return ui.notifications.warn('Макрос доступен только мастеру');
 const selected=canvas.tokens.controlled;
 const ignored=[],roster=[];
 for(const token of selected){if(!token.actor){ignored.push(token.name);continue;}const side=sideOf(token.actor);if(side===null){ignored.push(token.name);continue;}const u=snapshot(token.actor,side,token.id);if(u.hp>0)roster.push(u);else ignored.push(token.name+' (0 HP)');}
 if(ignored.length)ui.notifications.warn('Пропущены: '+ignored.join(', '));
 if(![0,1].every(s=>roster.some(u=>u.side===s)))return ui.notifications.warn('Выделите токены из «Игроки»/«Союзники» и «Враги»');
 if(roster.length>30)return ui.notifications.warn('Максимум 30 участников');
 const data=await foundry.applications.api.DialogV2.prompt({window:{title:'WIND · Оценка боя'},position:{width:850},content:`<p>Только выделенные токены. Сторона определяется папкой актёра, включая вложенные папки. Изменения ниже действуют только в прогнозе.</p><label>Инициатива <select name="initiative">${keys.map((k,i)=>`<option value="${k}" ${k==='combat'?'selected':''}>${names[i]}</option>`).join('')}</select></label><table><tr><th>Участник и оружие</th><th>HP</th><th>Атака</th><th>Защита</th><th>Мод.</th><th>Снижение урона</th></tr>${roster.map((u,i)=>`<tr><td>${esc(u.name)} · ${u.side?'Враг':'Союзник'}<br><small>${esc(u.weapon)}</small></td>${['hp','attack','defense','modifier','armor'].map(k=>`<td><input aria-label="${esc(u.name)} ${k}" name="${i}-${k}" type="number" min="0" step="1" value="${u[k]}" style="width:65px"></td>`).join('')}</tr>`).join('')}</table><p>Броня по умолчанию 0: текстовые правила предметов автоматически не распознаются. Пулы характеристик — целые 0–100.</p>`,ok:{label:'Рассчитать',callback:(_e,b)=>Object.fromEntries(new FormData(b.form))},rejectClose:false});
 if(!data)return;for(let i=0;i<roster.length;i++)for(const k of ['hp','attack','defense','modifier','armor'])roster[i][k]=Number(data[`${i}-${k}`]);
 try {const r=estimate(roster,data.initiative);const html=report(roster,r,data.initiative);await ChatMessage.create({content:html,whisper:[game.user.id],speaker:{alias:'WIND · Оценка боя'}});new foundry.applications.api.DialogV2({window:{title:'WIND · Результат'},position:{width:850},content:html,buttons:[{action:'close',label:'Закрыть'}]}).render(true);}catch(e){ui.notifications.error(e.message);}
}
export async function setup(){
 if(!game.user.isGM)throw Error('Только GM');
 const root=game.folders.find(f=>f.type==='Actor'&&f.name==='WIND · Полигон CODE RED');if(!root)throw Error('Папка Полигона не найдена');
 const folders={};for(const name of ['Игроки','Союзники','Враги'])folders[name]=game.folders.find(f=>f.type==='Actor'&&f.name===name&&f.folder?.id===root.id)??await Folder.create({name,type:'Actor',folder:root.id,sorting:'a'});
 const heroes=new Set(['iona','kushi','meredi','reiko','elias']);
 const belongs=a=>{let f=a.folder;const seen=new Set();while(f&&!seen.has(f.id)){if(f.id===root.id)return true;seen.add(f.id);f=f.folder;}return false;};
 for(const a of game.actors.filter(belongs)){const id=a.flags.windPlaytest?.id;if(id==='ally-soldier')continue;await a.update({folder:folders[heroes.has(id)?'Игроки':'Враги'].id});}
 const soldier=game.actors.find(a=>a.flags.windPlaytest?.id==='soldier');if(!soldier)throw Error('Болванка солдата не найдена');
 let ally=game.actors.find(a=>a.flags.windPlaytest?.id==='ally-soldier');if(!ally){const data=soldier.toObject();delete data._id;data.name='Полигон · Солдат-союзник';data.folder=folders['Союзники'].id;data.flags.windPlaytest={...data.flags.windPlaytest,id:'ally-soldier'};data.system.biography='<p>Тестовый союзник: обычный солдат с карабином. Механически копирует текущую болванку солдата.</p>';ally=await Actor.create(data);}else await ally.update({folder:folders['Союзники'].id});
 const command="await (await import('/systems/vitruviy/encounter/tool.mjs?v=4')).run();";
 let m=game.macros.find(m=>m.name==='WIND · Сложность боя');const md={name:'WIND · Сложность боя',type:'script',command,img:'icons/svg/combat.svg',ownership:{default:0}};if(m)await m.update(md);else await Macro.create(md);
 const rows=game.actors.filter(belongs).map(a=>snapshot(a,sideOf(a)));
 const content=`<h2>Распределение Полигона</h2><p>${rows.map(u=>`${esc(u.name)} → ${u.side?'Враги':game.actors.get(u.id?.split('.').pop())?.folder?.name??'Игроки / Союзники'}`).join('<br>')}</p><h3>Снимок для проверки</h3><pre>${esc(JSON.stringify(rows,null,2))}</pre>`;
 await journal('WIND · Состав для оценки боя',content);
 ui.notifications.info('Папки и макрос созданы; существующие характеристики сохранены');
}
async function journal(name,content){let j=game.journal.find(j=>j.name===name);if(j){const page=j.pages.contents[0];await page.update({'text.content':content});}else j=await JournalEntry.create({name,ownership:{default:0},pages:[{name,type:'text',text:{content,format:1}}]});return j;}
// Independent reference engine: native Foundry Roll, separately written turn loop.
export async function validate(initiative='movement'){
 if(!game.user.isGM)throw Error('Только GM');
 const chosen=canvas.tokens.controlled.filter(t=>t.actor&&sideOf(t.actor)!==null&&t.actor.system.health.value>0).map(t=>snapshot(t.actor,sideOf(t.actor),t.id));
 const prediction=estimate(chosen,initiative,10000,20261008);
 if(prediction.category!=='Тяжёлый')throw Error('Выделенный состав не относится к тяжёлому уровню');
 await journal('WIND · Проверка сложности · Зафиксированный состав',`<p>Выделенный состав зафиксирован до независимых 1000 боёв. Инициатива: ${names[keys.indexOf(initiative)]}. Сцена не меняется.</p><pre>${esc(JSON.stringify({prediction,initiative,roster:chosen},null,2))}</pre>`);
 let bank=[],cursor=0;async function die(){if(cursor>=bank.length){const r=await new Roll('999d6').evaluate();bank=r.dice.flatMap(d=>d.results.filter(x=>x.active!==false).map(x=>x.result));cursor=0;}return bank[cursor++];}
 async function pool(n){let sum=0;for(let i=0;i<n;i++){const f=await die();if(f===6)sum+=2;else if(f===4||f===5)sum++;}return sum;}
 let wins=0,draws=0,totalRounds=0;const outcomes=[];
 for(let b=0;b<1000;b++){const hp=chosen.map(u=>u.hp),order=[];for(let i=0;i<chosen.length;i++)order.push({i,initiative:await pool(chosen[i].stats[initiative]),tie:Math.random()});order.sort((a,b)=>b.initiative-a.initiative||b.tie-a.tie);let winner=null,round=0;
 outer:for(round=1;round<=100;round++){for(const o of order){const live=[0,1].map(s=>chosen.map((u,i)=>u.side===s&&hp[i]>0?i:-1).filter(i=>i>=0));if(!live[0].length||!live[1].length){winner=live[0].length?0:1;break outer;}if(hp[o.i]<=0)continue;const u=chosen[o.i],targets=live[1-u.side],ti=targets[Math.floor(Math.random()*targets.length)],v=chosen[ti],attack=await pool(u.attack),defense=await pool(v.defense);if(attack>defense)hp[ti]=hp[ti]-Math.max(0,attack*u.modifier-v.armor);}}
 if(winner===null){if(chosen.every((u,i)=>u.side!==1||hp[i]<=0))winner=0;else if(chosen.every((u,i)=>u.side!==0||hp[i]<=0))winner=1;}
 wins+=winner===0;draws+=winner===null;totalRounds+=Math.min(round,100);outcomes.push(winner);if((b+1)%100===0)ui.notifications.info(`Проверка WIND: ${b+1}/1000`);
 }
 const actual={n:1000,wins,draws,p:wins/1000,interval:interval(wins,1000),rounds:totalRounds/1000,category:category(wins/1000)};
 const difference=Math.abs(actual.p-prediction.p),tolerance=1.96*Math.sqrt(prediction.p*(1-prediction.p)/prediction.n+actual.p*(1-actual.p)/1000);
 const result={prediction,actual,initiative,difference,tolerance,consistent:difference<=tolerance,roster:chosen,outcomes};
 const html=`<h2>1000 независимых тяжёлых боёв</h2><p>Прогноз: ${(prediction.p*100).toFixed(1)}%; результат: ${(actual.p*100).toFixed(1)}% (${wins}/1000), ничьи: ${draws}. Разница ${(difference*100).toFixed(2)} п.п.; ожидаемый 95% разброс ±${(tolerance*100).toFixed(2)} п.п. ${result.consistent?'Согласуется с прогнозом':'Не согласуется: нужна проверка модели'}.</p><p>Эталон использует нативные Roll Foundry, отдельный цикл боя. Проверены обычные атаки; свободные эффекты способностей не проверены этим экспериментом.</p><pre>${esc(JSON.stringify(result,null,2))}</pre>`;
 const j=await journal('WIND · Проверка сложности · 1000 боёв',html);j.sheet.render(true);return result;
}

