// randomUUID requires a secure browser context; Foundry also supports plain HTTP clients.
export function randomId() {
  if (typeof globalThis.foundry?.utils?.randomID === 'function')
    return globalThis.foundry.utils.randomID(32);
  // Standalone consumers and tests can use getRandomValues, available on plain HTTP too.
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
}
