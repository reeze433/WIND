import {randomId} from './random-id.mjs';
import {checkedUpdate} from './document-writes.mjs';

const handlers = new Map();
let queue = Promise.resolve(), enabled = false;
export function serializeOperation(callback) {
  const operation = queue.then(callback);
  queue = operation.catch(() => {});
  return operation;
}
export function registerResourceAction(kind, handler) { handlers.set(kind, handler); }
const text = key => game.i18n.localize(`VIT.${key}`);
const resultKey = id => `operationResults.${id}`;

export async function processResourceRequest(actor, id, request, userId) {
  if (game.users.activeGM?.id !== game.user.id) return;
  const user = game.users.get(userId), handler = handlers.get(request?.kind);
  if (!/^[a-zA-Z0-9-]{1,64}$/.test(id) || !handler || !user || !actor.testUserPermission(user, 'OWNER')) return;
  if (actor.getFlag('vitruviy', resultKey(id))) return;
  // A request is never replayed automatically after a GM disconnect or restart.
  await checkedUpdate(actor, {[`flags.vitruviy.${resultKey(id)}`]: {status:'pending',kind:request.kind,time:Date.now()}});
  let result;
  try {
    if (!Number.isFinite(request.time) || Math.abs(Date.now()-request.time)>60000) throw new Error(text('OperationExpired'));
    await handler(actor, request.payload ?? {}, user);
    result = {status:'completed',kind:request.kind,time:Date.now()};
  } catch (error) { result = {status:'failed',kind:request.kind,time:Date.now(), error:error.message}; }
  await checkedUpdate(actor, {[`flags.vitruviy.${resultKey(id)}`]:result,[`flags.vitruviy.operationRequests.-=${id}`]:null});
}

export async function resourceOperation(actor, kind, payload, local) {
  if (!actor?.isOwner) throw new Error(text('NoPermission'));
  // Pure unit tests and import-only consumers do not install the world transport.
  if (!enabled) return local();
  const gm = game.users.activeGM;
  if (!gm) throw new Error(text('ResourceNeedsGM'));
  const id = randomId();
  if (gm.id === game.user.id) return serializeOperation(async()=>{
    await checkedUpdate(actor,{[`flags.vitruviy.${resultKey(id)}`]:{status:'pending',kind,time:Date.now()}});
    let result;
    try{result=await local();}
    catch(error){await checkedUpdate(actor,{[`flags.vitruviy.${resultKey(id)}`]:{status:'failed',kind,time:Date.now(),error:error.message}});throw error;}
    await checkedUpdate(actor,{[`flags.vitruviy.${resultKey(id)}`]:{status:'completed',kind,time:Date.now()}});
    return result;
  });
  return new Promise((resolve, reject) => {
    let hook, timer, settled=false;
    const finish = error => { if(settled)return;settled=true;Hooks.off('updateActor', hook); clearTimeout(timer); error ? reject(error) : resolve(true); };
    hook = Hooks.on('updateActor', changed => {
      if (changed.uuid !== actor.uuid) return;
      const result = changed.getFlag('vitruviy', resultKey(id));
      if (result?.status === 'completed') finish();
      else if (result?.status === 'failed') finish(new Error(result.error));
    });
    timer = setTimeout(() => finish(new Error(text('OperationUnconfirmed'))), 30000);
    checkedUpdate(actor, {[`flags.vitruviy.operationRequests.${id}`]:{kind,payload,time:Date.now()}})
      .catch(finish);
  });
}

export function registerResourceOperations() {
  if (enabled) return;
  enabled = true;
  Hooks.on('updateActor', (actor, changes, _options, userId) => {
    if (game.users.activeGM?.id !== game.user.id) return;
    for (const [id, request] of Object.entries(changes.flags?.vitruviy?.operationRequests ?? {}))
      serializeOperation(() => processResourceRequest(actor,id,request,userId)).catch(error => {
        console.error(error); ui.notifications.error(text('OperationUnconfirmed'));
      });
  });
  Hooks.once('ready',()=>{
    if(game.users.activeGM?.id!==game.user.id)return;
    for(const actor of game.actors??[])
      if(Object.values(actor.getFlag('vitruviy','operationResults')??{}).some(record=>record.status==='pending'))
        ui.notifications.warn(`${actor.name}: ${text('OperationPendingReview')}`);
  });
}

