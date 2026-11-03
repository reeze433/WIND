import test from 'node:test';
import assert from 'node:assert/strict';
import {randomId} from '../system/scripts/random-id.mjs';

test('uses the native Foundry generator without touching crypto.randomUUID',()=>{
 const saved=globalThis.foundry;
 try{
  let length;globalThis.foundry={utils:{randomID:value=>{length=value;return 'NativeFoundryIdentifier0000000001';}}};
  assert.equal(randomId(),'NativeFoundryIdentifier0000000001');assert.equal(length,32);
 }finally{globalThis.foundry=saved;}
});
test('HTTP-like client without randomUUID generates distinct, flag-safe IDs',()=>{
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'crypto'),saved=globalThis.foundry,webCrypto=globalThis.crypto;
 try{
  globalThis.foundry={};
  Object.defineProperty(globalThis,'crypto',{configurable:true,value:{getRandomValues:array=>webCrypto.getRandomValues(array)}});
  assert.equal(typeof crypto.randomUUID,'undefined');
  const ids=Array.from({length:1000},()=>randomId());
  assert.equal(new Set(ids).size,1000);assert.ok(ids.every(id=>/^[a-zA-Z0-9-]{32}$/.test(id)));
 }finally{Object.defineProperty(globalThis,'crypto',descriptor);globalThis.foundry=saved;}
});
