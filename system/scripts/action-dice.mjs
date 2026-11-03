import {checkedUpdate} from './document-writes.mjs';
// DsN animates added rolls, not replacement arrays of the same length.
// Keep prior rolls only for the same audience; never make a former private roll public.
export async function updateActionRoll(message,data){
 data={...data,whisper:[...(data.whisper??[])],blind:data.blind===true};
 const previous=[...(message.rolls??[])],audience=value=>JSON.stringify([!!value.blind,[...(value.whisper??[])].sort()]);
 const same=audience(message)===audience(data);
 if(previous.length&&!same)await checkedUpdate(message,{rolls:[]});
 return checkedUpdate(message,{...data,rolls:[...(same?previous:[]),...data.rolls]});
}
