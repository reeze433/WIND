import {t,escape} from './rolls.mjs';

export const DEFAULT_INSPIRATION_MESSAGES={
 gain:'{Игрок} получает {Вдохновение}: +{Количество}. Теперь: {Стало}.',
 spend:'{Игрок} тратит {Вдохновение}: -{Количество}. Осталось: {Стало}.',
 edit:'{Игрок}: {Вдохновение} изменено с {Было} на {Стало}.'
};
export function inspirationTemplates(value={}){
 const result={};
 for(const key of Object.keys(DEFAULT_INSPIRATION_MESSAGES)){
  const text=String(value[key]??DEFAULT_INSPIRATION_MESSAGES[key]).trim();
  if(!text||text.length>600)throw Error('VIT.InvalidInspirationTemplate');
  result[key]=text;
 }
 return result;
}
export function inspirationText(actor,{kind='spend',before,after,amount=Math.abs(after-before),userId=game.user?.id}={}){
 const templates={...DEFAULT_INSPIRATION_MESSAGES,...game.settings?.get('vitruviy','inspirationMessages')};
 const values={Игрок:actor.name,Персонаж:actor.name,Пользователь:game.users?.get?.(userId)?.name??'',Вдохновение:t('Inspiration'),Количество:amount,Было:before,Стало:after};
 return escape(String(templates[kind]??templates.spend).replace(/\{([^{}]+)\}/g,(match,key)=>Object.hasOwn(values,key)?String(values[key]??''):match));
}
export function inspirationReceipt(actor,event){return `<p class="vit-inspiration-event">${inspirationText(actor,event)}</p>`;}
export function captureInspirationChange(actor,changes,options){
 const flat=foundry.utils.flattenObject(changes),value=flat['system.inspiration.value'];
 if(value===undefined)return;
 const before=actor.system.inspiration.value,after=Number(value);
 if(!Number.isSafeInteger(after)||after<0)return false;
 if(before===after)return;
 options.vitruviyInspirationChange={before,after,amount:Math.abs(after-before),kind:options.vitruviyInspirationEdit?'edit':after<before?'spend':'gain'};
}
export async function announceInspirationChange(actor,_changes,options,userId){
 if(userId!==game.user.id||options.vitruviyItemMessageId||options.vitruviyInspirationSilent)return;
 const event=options.vitruviyInspirationChange;
 if(!event)return;
 const resource=event.kind==='spend'&&options.vitruviyInspirationUseId?{resource:{actorUuid:actor.uuid,cost:event.amount,useId:options.vitruviyInspirationUseId,refundOnly:true}}:{};
 await ChatMessage.create({speaker:ChatMessage.getSpeaker({actor}),content:`<article class="vit-chat">${inspirationReceipt(actor,{...event,userId})}</article>`,flags:{vitruviy:resource}});
}
