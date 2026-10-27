/** localStorage の必要最小限の面。テストでは差し替える。 */
export interface KeyValueStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** テストおよび localStorage が使えない環境（SSR 等）向けの実装。 */
export class MemoryStorage implements KeyValueStorage {
  private readonly map = new Map<string, string>()

  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }

  removeItem(key: string): void {
    this.map.delete(key)
  }
}

/**
 * ブラウザの localStorage。SSR やプライベートモードでの例外を吸収する。
 * 保存に失敗してもトレーニングは続行できるべきなので、投げずに黙って諦める。
 */
export function createBrowserStorage(): KeyValueStorage {
  if (typeof window === 'undefined' || !('localStorage' in window)) {
    return new MemoryStorage()
  }
  try {
    const probe = '__srl_probe__'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
  } catch {
    return new MemoryStorage()
  }
  return {
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => {
      try {
        window.localStorage.setItem(key, value)
      } catch {
        // 容量超過などは無視する（トレーニング自体は継続させる）
      }
    },
    removeItem: (key) => window.localStorage.removeItem(key),
  }
}
