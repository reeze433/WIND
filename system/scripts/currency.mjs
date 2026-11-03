import {randomId} from './random-id.mjs';
import {checkedUpdate} from './document-writes.mjs';
import {serializeOperation} from './operations.mjs';
import {t,escape} from './rolls.mjs';
import {currencyTypes} from './presentation.mjs';
const busy=new Set();

export function currencyRecipients(source){
  return [...(game.user.targets??[])].map(token=>token.actor).filter(actor=>actor&&actor.uuid!==source.uuid);
}

export async function processCurrencyTransfer(source,request,userId){
  if(game.users.activeGM?.id!==game.user.id)return;
  const user=game.users.get(userId);
  if(!request || !/^[a-zA-Z0-9-]{1,64}$/.test(request.id??'') || !user || !source.testUserPermission(user,'OWNER'))return;
  const resultKey=`currencyTransfers.${request.id}`;
  if(source.getFlag('vitruviy',resultKey))return;
  let debited=false,credited=false;
  const amount=request.amount,currency=request.currency;
  let target;
  const balance=()=>Number(source.system.currencies?.[currency]??0);
  try{
    target=typeof request.targetUuid==='string'?await fromUuid(request.targetUuid):null;
    if(!target || target.documentName!=='Actor' || target.uuid===source.uuid || !['character','npc'].includes(target.type))throw new Error(t('InvalidCurrencyRecipient'));
    if(!currencyTypes().some(entry=>entry.id===currency)||!Number.isSafeInteger(amount)||amount<=0)throw new Error(t('InvalidCurrencyValue'));
    const current=balance(),received=Number(target.system.currencies?.[currency]??0);
    if(!Number.isSafeInteger(current)||current<amount)throw new Error(t('NotEnoughCurrency'));
    if(!Number.isSafeInteger(received)||received<0||!Number.isSafeInteger(received+amount))throw new Error(t('InvalidCurrencyValue'));
    const receiptId=`${source.uuid.replace(/[^a-zA-Z0-9-]/g,'_')}-${request.id}`;
    const receipt={protocol:2,status:'pending',targetUuid:target.uuid,targetId:target.id,currency,amount,receiptId};
    await checkedUpdate(source,{[`system.currencies.${currency}`]:current-amount,[`flags.vitruviy.${resultKey}`]:receipt});
    debited=true;
    await checkedUpdate(target,{[`system.currencies.${currency}`]:received+amount,[`flags.vitruviy.currencyReceipts.${receiptId}`]:{sourceUuid:source.uuid,currency,amount}});credited=true;
    await checkedUpdate(source,{[`flags.vitruviy.${resultKey}`]:{...receipt,status:'completed'}});
  }catch(error){
    if(debited&&!credited){
      try{await checkedUpdate(source,{[`system.currencies.${currency}`]:balance()+amount,[`flags.vitruviy.${resultKey}`]:{status:'failed',error:error.message}});}
      catch(rollbackError){console.error(rollbackError);ui.notifications.error(t('CurrencyRollbackFailed'));}
    }else if(!debited)await source.setFlag('vitruviy',resultKey,{status:'failed',error:error.message});
    else ui.notifications.error(t('CurrencyReceiptFailed'));
    return;
  }
  const name=currencyTypes().find(entry=>entry.id===currency)?.name??currency;
  try{await ChatMessage.create({content:`<article class="vit-chat"><p>${escape(source.name)} → ${escape(target.name)}: <strong>${amount} ${escape(name)}</strong></p></article>`,whisper:[...new Set([user.id,...game.users.filter(u=>u.isGM||target.testUserPermission(u,'OWNER')).map(u=>u.id)])]});}
  catch(error){console.error(error);}
}

export function registerCurrencyTransfers(){
  serializeOperation(()=>recoverCurrencyTransfers()).catch(error=>{console.error(error);ui.notifications.error(t('CurrencyReceiptFailed'));});
  Hooks.on('updateActor',(actor,changes,_options,userId)=>{
    const request=changes.flags?.vitruviy?.currencyTransferRequest;
    if(request&&game.users.activeGM?.id===game.user.id)
      enqueueCurrencyTransfer(actor,{...actor.getFlag('vitruviy','currencyTransferRequest'),...request},userId).catch(console.error);
    if(actor.isOwner){
      const results=changes.flags?.vitruviy?.currencyTransfers;
      for(const result of Object.values(results??{})){
        if(result?.status==='completed')ui.notifications.info(t('CurrencyTransferred'));
        else if(result?.status==='failed')ui.notifications.warn(result.error??t('CurrencyTransferFailed'));
      }
    }
  });
}

// A recipient receipt is committed with the credit, allowing safe recovery after a restart.
export async function recoverCurrencyTransfers(){
  if(game.users.activeGM?.id!==game.user.id)return;
  for(const source of game.actors??[]){
    for(const [id,record] of Object.entries(source.getFlag('vitruviy','currencyTransfers')??{})){
      if(record?.status!=='pending')continue;
      if(record.protocol!==2){ui.notifications.warn(`${source.name}: ${t('CurrencyPendingReview')}`);continue;}
      const target=await fromUuid(record.targetUuid);
      if(!target){ui.notifications.warn(`${source.name}: ${t('CurrencyPendingReview')}`);continue;}
      const receipt=target.getFlag('vitruviy',`currencyReceipts.${record.receiptId}`);
      if(receipt){
        if(receipt.sourceUuid!==source.uuid||receipt.amount!==record.amount||receipt.currency!==record.currency){ui.notifications.warn(t('CurrencyPendingReview'));continue;}
        await checkedUpdate(source,{[`flags.vitruviy.currencyTransfers.${id}`]:{...record,status:'completed'}});
      }else{
        const balance=Number(source.system.currencies?.[record.currency]??0)+record.amount;
        if(!Number.isSafeInteger(record.amount)||record.amount<=0||!Number.isSafeInteger(balance)){ui.notifications.warn(t('CurrencyPendingReview'));continue;}
        await checkedUpdate(source,{[`system.currencies.${record.currency}`]:balance,[`flags.vitruviy.currencyTransfers.${id}`]:{...record,status:'failed',error:t('CurrencyRecovered')}});
      }
    }
  }
}

export function enqueueCurrencyTransfer(actor,request,userId){
  const operation=serializeOperation(()=>processCurrencyTransfer(actor,request,userId));
  return operation;
}

export async function transferCurrency(source){
  if(!source?.isOwner)throw new Error(t('NoPermission'));
  if(busy.has(source.uuid))return;
  if(!game.users.activeGM)throw new Error(t('CurrencyNeedsGM'));
  busy.add(source.uuid);
  try{
    const recipients=currencyRecipients(source);
    if(game.user.targets?.size!==1 || recipients.length!==1)throw new Error(t('InvalidCurrencyRecipient'));
    const target=recipients[0];
    const types=currencyTypes();
    const values=await foundry.applications.api.DialogV2.prompt({classes:['vitruviy','vit-dialog'],window:{title:t('TransferCurrency')},
      content:`<div class="vit-roll-form"><p>${t('CurrencyRecipient')}: <strong>${escape(target.name)}</strong></p><label>${t('CurrencyType')}<select name="currency">${types.map(entry=>`<option value="${escape(entry.id)}">${escape(entry.name)} (${Number(source.system.currencies?.[entry.id]??0)})</option>`).join('')}</select></label><label>${t('CurrencyAmount')}<input name="amount" type="number" min="1" step="1" required></label></div>`,
      ok:{label:t('TransferCurrency'),callback:(_event,button)=>Object.fromEntries(new FormData(button.form))},rejectClose:false});
    if(!values)return;
    if(!game.users.activeGM)throw new Error(t('CurrencyNeedsGM'));
    const amount=Number(values.amount);
    if(!Number.isSafeInteger(amount)||amount<=0)throw new Error(t('InvalidCurrencyValue'));
    if(amount>Number(source.system.currencies?.[values.currency]??0))throw new Error(t('NotEnoughCurrency'));
    await source.setFlag('vitruviy','currencyTransferRequest',{id:randomId(),targetUuid:target.uuid,currency:values.currency,amount});
    ui.notifications.info(t('CurrencyTransferPending'));
  }finally{busy.delete(source.uuid);}
}
