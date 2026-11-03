// Run the actual services and client transport in the environment that broke player actions.
Object.defineProperty(globalThis.crypto, 'randomUUID', {value:undefined, configurable:true});
