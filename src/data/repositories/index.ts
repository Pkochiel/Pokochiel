import { getPersistentStore } from '@/data/persistence'
import { RecordStoreRepository } from './repository'
import type { TrainingRepository } from './types'

export type { TrainingRepository } from './types'
export { LOCAL_USER_ID } from './repository'

let instance: TrainingRepository | null = null

/**
 * 使用する Repository を決める唯一の場所。
 *
 * 保存先（IndexedDB / localStorage）の決定は data/persistence 側にあり、
 * ここでは「Repository を組み立てる」だけ。将来 Supabase Sync を足す場合も
 * 差し込み位置は保存先の組み立てであって、この関数のシグネチャは変えない。
 */
export function getRepository(): TrainingRepository {
  if (instance) return instance
  instance = new RecordStoreRepository({
    store: getPersistentStore(),
    now: () => new Date(),
    createId: () => globalThis.crypto.randomUUID(),
    defaultTimezone: resolveTimezone(),
  })
  return instance
}

/** テスト・開発用に差し替える。 */
export function setRepository(repository: TrainingRepository | null): void {
  instance = repository
}

export function resolveTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Tokyo'
  } catch {
    return 'Asia/Tokyo'
  }
}
