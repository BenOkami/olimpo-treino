// Camada fina sobre IndexedDB. Todos os dados ficam no aparelho.

const DB_NAME = 'treino-integrado';
const VERSION = 1;
export const STORES = ['kv', 'sessions', 'body', 'recovery', 'reschedules'];

let dbp;
function open() {
  if (!dbp) dbp = new Promise((res, rej) => {
    const r = indexedDB.open(DB_NAME, VERSION);
    r.onupgradeneeded = () => {
      const d = r.result;
      for (const s of STORES) {
        if (d.objectStoreNames.contains(s)) continue;
        const os = d.createObjectStore(s, { keyPath: 'id' });
        if (s !== 'kv') os.createIndex('date', 'date');
      }
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  return dbp;
}

async function tx(store, mode, fn) {
  const d = await open();
  return new Promise((res, rej) => {
    const t = d.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => res(req?.result);
    t.onerror = () => rej(t.error);
  });
}

export const db = {
  all: s => tx(s, 'readonly', os => os.getAll()),
  get: (s, id) => tx(s, 'readonly', os => os.get(id)),
  put: (s, v) => tx(s, 'readwrite', os => os.put(v)),
  del: (s, id) => tx(s, 'readwrite', os => os.delete(id)),
  clear: s => tx(s, 'readwrite', os => os.clear()),
};
