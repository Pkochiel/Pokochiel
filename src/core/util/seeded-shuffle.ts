/**
 * 決定的なシャッフル。
 * 選択肢の並びは「毎回同じ」でなければならない（SSR とクライアントで一致させる必要がある）が、
 * 「正解が常に先頭」でもいけない。そのため乱数ではなく seed 由来の擬似乱数で並べ替える。
 */

/** FNV-1a による文字列ハッシュ。 */
export function hashString(input: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** mulberry32。seed から再現可能な 0–1 の値を返す。 */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** seed が同じなら常に同じ順序を返す Fisher-Yates シャッフル。 */
export function seededShuffle<T>(items: readonly T[], seed: string): T[] {
  const result = [...items]
  const random = createRandom(hashString(seed))
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    const a = result[i]
    const b = result[j]
    if (a === undefined || b === undefined) continue
    result[i] = b
    result[j] = a
  }
  return result
}
