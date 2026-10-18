// Native saves commit synchronously before Storage.setItem returns. Never fall
// back to web storage after a native failure: callers must see a failed save.
export function createNativeStorage(transport) {
  function request(op, key, value) {
    let reply;
    try {
      reply = JSON.parse(transport(JSON.stringify({ op, ...(key === undefined ? {} : { key }),
        ...(value === undefined ? {} : { value }) })));
      if (!reply || reply.ok !== true) {
        const error = new Error(reply?.error || 'Device storage is unavailable.');
        error.name = reply?.name || 'InvalidStateError';
        throw error;
      }
    } catch (error) {
      globalThis.dispatchEvent?.(new Event('mm-storage-error'));
      throw error;
    }
    return reply.value;
  }
  return Object.freeze({
    get length() { return request('length'); },
    key(index) { return request('key', Number(index)); },
    getItem(key) { return request('get', String(key)); },
    setItem(key, value) { request('set', String(key), String(value)); },
    removeItem(key) { request('remove', String(key)); },
    clear() { request('clear'); },
  });
}

let nativeStorage;
export function isNativeStorage() { return globalThis.__MM_NATIVE__ === true; }
export function getGameStorage() {
  if (!isNativeStorage()) return globalThis.localStorage;
  nativeStorage ||= createNativeStorage((payload) => globalThis.prompt('__MM_STORAGE_V1__', payload));
  return nativeStorage;
}
