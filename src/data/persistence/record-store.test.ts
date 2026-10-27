import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it } from 'vitest'
import { IndexedDbRecordStore } from './indexeddb/indexeddb-store'
import { MemoryStorage } from './key-value-storage'
import { LocalStorageRecordStore } from './local-storage-store'
import { MemoryRecordStore } from './memory-store'
import { describeRecordStoreContract } from './record-store-contract'

describeRecordStoreContract('MemoryRecordStore', () => new MemoryRecordStore())

describeRecordStoreContract(
  'LocalStorageRecordStore',
  () => new LocalStorageRecordStore(new MemoryStorage()),
)

// IndexedDB は実装を差し替えず、テスト用の IDBFactory だけを注入して検証する。
describeRecordStoreContract(
  'IndexedDbRecordStore',
  () => new IndexedDbRecordStore({ factory: new IDBFactory() }),
)

describe('IndexedDbRecordStore の自己修復', () => {
  it('object store の無い DB が既にあっても保存できる', async () => {
    const factory = new IDBFactory()
    // 別の経路で「空の DB」が作られてしまった状態を再現する
    await new Promise<void>((resolve, reject) => {
      const request = factory.open('speed-reading-lab', 1)
      request.onsuccess = () => {
        request.result.close()
        resolve()
      }
      request.onerror = () => reject(request.error)
    })

    const store = new IndexedDbRecordStore({ factory })
    await store.put('results', { id: 'r1' })
    expect(await store.list('results')).toHaveLength(1)
  })
})
