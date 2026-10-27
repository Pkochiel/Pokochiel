import { DeferredRecordStore } from './deferred-store'
import { IndexedDbRecordStore } from './indexeddb/indexeddb-store'
import type { KeyValueStorage } from './key-value-storage'
import { importLegacyRecords } from './legacy-migration'
import { LocalStorageRecordStore } from './local-storage-store'
import type { RecordStore } from './record-store'

/** 接続がこの時間で確立しなければ、待たずに代替の保存先へ切り替える。 */
const OPEN_TIMEOUT_MS = 3000

export interface LocalFirstStoreDeps {
  storage: KeyValueStorage
  /** 使えない環境では null を渡す。 */
  indexedDB: IDBFactory | null
  openTimeoutMs?: number
}

/** 実行環境の IndexedDB。SSR や無効化された環境では null。 */
export function detectIndexedDb(): IDBFactory | null {
  try {
    return typeof globalThis.indexedDB === 'undefined' ? null : globalThis.indexedDB
  } catch {
    return null
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('IndexedDB open timed out')), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error instanceof Error ? error : new Error(String(error)))
      },
    )
  })
}

/**
 * Local First の保存先を組み立てる唯一の場所。
 *
 * 1. IndexedDB を開く。開けなければ localStorage に退避する
 *    （クラウドも IndexedDB も無い環境で、トレーニングが止まらないことを優先する）。
 * 2. 初回だけ Phase 1 の localStorage データを移送する。
 *
 * 将来 Supabase Sync を足すときは、ここで RecordStore をデコレータで包む。
 * Repository・UI・Core Domain はいずれも変更しない。
 */
export function createLocalFirstStore(deps: LocalFirstStoreDeps): RecordStore {
  return new DeferredRecordStore(async () => {
    const fallback = new LocalStorageRecordStore(deps.storage)
    if (!deps.indexedDB) return fallback

    const store = new IndexedDbRecordStore({ factory: deps.indexedDB })
    try {
      await withTimeout(store.open(), deps.openTimeoutMs ?? OPEN_TIMEOUT_MS)
    } catch {
      return fallback
    }

    try {
      await importLegacyRecords(store, deps.storage)
    } catch {
      // 移送に失敗しても保存先としては使える。旧キーは消していないので次回やり直す。
    }
    return store
  })
}
