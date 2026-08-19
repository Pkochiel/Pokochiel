/**
 * IndexedDB を Promise に均す最小のラッパー。
 *
 * **IndexedDB 固有の型と呼び出しは、このディレクトリの外へ出さない。**
 * 上位（Repository / features / core）が知っているのは RecordStore だけであり、
 * 保存先を差し替えても UI と Core Domain は変更しない。
 */

export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

export function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    transaction.onabort = () =>
      reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
  })
}

export interface OpenDatabaseOptions {
  factory: IDBFactory
  name: string
  version: number
  upgrade: (database: IDBDatabase) => void
}

export function openDatabase(options: OpenDatabaseOptions): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = options.factory.open(options.name, options.version)
    request.onupgradeneeded = () => options.upgrade(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'))
    request.onsuccess = () => {
      const database = request.result
      // 別タブが新しいスキーマで開いたら接続を手放す（相手の upgrade を止めない）。
      database.onversionchange = () => database.close()
      resolve(database)
    }
  })
}

/** 1 リクエストで完結する読み出し。 */
export async function readFromStore<T>(
  database: IDBDatabase,
  storeName: string,
  work: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const transaction = database.transaction(storeName, 'readonly')
  const request = work(transaction.objectStore(storeName))
  const [value] = await Promise.all([requestToPromise(request), transactionDone(transaction)])
  return value
}

/**
 * 書き込み。work の中でリクエストを同期的に発行すること
 * （途中で await するとトランザクションが自動で閉じるため）。
 * 複数リクエストでも 1 トランザクションで不可分に確定する。
 */
export async function writeToStore(
  database: IDBDatabase,
  storeName: string,
  work: (store: IDBObjectStore) => void,
): Promise<void> {
  const transaction = database.transaction(storeName, 'readwrite')
  work(transaction.objectStore(storeName))
  await transactionDone(transaction)
}
