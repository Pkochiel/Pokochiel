import type { KeyValueStorage } from './key-value-storage'
import { LocalStorageRecordStore } from './local-storage-store'
import { COLLECTIONS, type CollectionName, type RecordStore, type StoredRecord } from './record-store'

export interface LegacyImportReport {
  imported: Record<CollectionName, number>
  total: number
}

const emptyReport = (): Record<CollectionName, number> => ({
  profile: 0,
  sessions: 0,
  results: 0,
  readingTests: 0,
  recallTasks: 0,
  plans: 0,
  // Phase 1 の localStorage には存在しない collection。移送元がないので常に 0。
  btrResults: 0,
})

/**
 * Phase 1 の localStorage に残っている記録を、新しい保存先へ移送する。
 *
 * - 移送は「移動」であって複製ではない。取り込み後に旧キーを消し、
 *   正となる保存先を常に 1 つに保つ（二重管理での取りこぼしを防ぐ）。
 * - 取り込みは id 単位の upsert なので、途中で中断されても再実行で回復する。
 * - 旧キーが無ければ何もしない。起動のたびに呼んでよい。
 */
export async function importLegacyRecords(
  target: RecordStore,
  storage: KeyValueStorage,
): Promise<LegacyImportReport> {
  const source = new LocalStorageRecordStore(storage)
  const imported = emptyReport()
  const moved: CollectionName[] = []

  for (const collection of COLLECTIONS) {
    const rows = (await source.list(collection)) as StoredRecord[]
    if (rows.length === 0) continue
    await target.putMany(collection, rows)
    imported[collection] = rows.length
    moved.push(collection)
  }

  // すべて書き込めてから旧キーを消す。途中で失敗した場合は次回の起動でやり直す。
  for (const collection of moved) await source.clear(collection)

  return { imported, total: Object.values(imported).reduce((sum, n) => sum + n, 0) }
}
