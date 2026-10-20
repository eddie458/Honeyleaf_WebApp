// A tiny IndexedDB wrapper: the browser-side safety net.
//
// Every change to an entry lands here first (drafts), and photos wait here
// until they're uploaded (outbox). One database per person, so two people
// sharing a device never mix their drafts.

type StoreName = 'drafts' | 'outbox' | 'meta';

let dbPromise: Promise<IDBDatabase> | null = null;
let dbName = '';

export function useDatabaseFor(userId: number): void {
  const name = `honeyleaf-u${userId}`;
  if (name === dbName) return;
  dbName = name;
  dbPromise = null;
}

function open(): Promise<IDBDatabase> {
  if (!dbName) return Promise.reject(new Error('No diary is open.'));
  dbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(dbName, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const s of ['drafts', 'outbox', 'meta'] as const) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB is unavailable'));
  });
  return dbPromise;
}

function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        tx.oncomplete = () => resolve(req.result as T);
        tx.onerror = () => reject(tx.error ?? req.error);
        tx.onabort = () => reject(tx.error ?? new Error('IndexedDB transaction aborted'));
      }),
  );
}

export const idbGet = <T>(store: StoreName, key: string) => run<T | undefined>(store, 'readonly', (s) => s.get(key));
export const idbPut = (store: StoreName, key: string, value: unknown) => run<IDBValidKey>(store, 'readwrite', (s) => s.put(value, key));
export const idbDelete = (store: StoreName, key: string) => run<undefined>(store, 'readwrite', (s) => s.delete(key));
export const idbAll = <T>(store: StoreName) => run<T[]>(store, 'readonly', (s) => s.getAll());
export const idbKeys = (store: StoreName) => run<IDBValidKey[]>(store, 'readonly', (s) => s.getAllKeys());
