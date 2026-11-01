// 未送信の写真を IndexedDB に保存（localStorage は容量が小さいため）
const DB_NAME = 'spot-stamp';
const STORE = 'photos';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not available'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('failed to open IndexedDB'));
  }).catch((err) => {
    dbPromise = null; // 次回リトライできるように
    throw err;
  });
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        t.oncomplete = () => resolve(req.result);
        t.onerror = () => reject(t.error ?? new Error('IndexedDB transaction failed'));
        t.onabort = () => reject(t.error ?? new Error('IndexedDB transaction aborted'));
      }),
  );
}

export const photoStore = {
  put: (key: string, blob: Blob) => tx('readwrite', (s) => s.put(blob, key)).then(() => undefined),
  get: (key: string) => tx<Blob | undefined>('readonly', (s) => s.get(key) as IDBRequest<Blob | undefined>),
  delete: (key: string) => tx('readwrite', (s) => s.delete(key)).then(() => undefined),
};
