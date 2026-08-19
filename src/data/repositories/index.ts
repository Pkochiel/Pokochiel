import { LocalStorageRepository } from './local-storage'
import { createBrowserStorage } from './storage'
import type { TrainingRepository } from './types'

export type { TrainingRepository } from './types'
export { LOCAL_USER_ID } from './local-storage'

let instance: TrainingRepository | null = null

/**
 * 使用する Repository を決める唯一の場所。
 *
 * Phase 2 で Supabase を導入する際は、環境変数の有無でここだけを分岐させる。
 * 画面側は TrainingRepository にしか依存していないため、UI の変更は発生しない。
 */
export function getRepository(): TrainingRepository {
  if (instance) return instance
  instance = new LocalStorageRepository({
    storage: createBrowserStorage(),
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
