/**
 * ペーサーの位置計算（純粋関数）。
 *
 * 目標速度から「いま何文字目を読んでいるはずか」を求め、
 * それが何番目のチャンクに当たるかを返す。
 * 時刻の取得と描画は呼び出し側（requestAnimationFrame）の責務。
 */

export interface ChunkOffset {
  /** チャンクの開始位置（文字数） */
  start: number
  /** チャンクの終了位置（文字数、この位置は含まない） */
  end: number
}

/** 各チャンクの累積位置を求める。 */
export function chunkOffsets(chunks: readonly string[]): ChunkOffset[] {
  const offsets: ChunkOffset[] = []
  let cursor = 0
  for (const chunk of chunks) {
    offsets.push({ start: cursor, end: cursor + chunk.length })
    cursor += chunk.length
  }
  return offsets
}

/** 経過秒と目標速度から、読み進んでいるはずの文字位置を求める。 */
export function charPositionAt(elapsedSeconds: number, targetCpm: number): number {
  if (elapsedSeconds <= 0 || targetCpm <= 0) return 0
  return (targetCpm / 60) * elapsedSeconds
}

/**
 * 文字位置に対応するチャンクの番号。
 * 位置が末尾を超えた場合は最後のチャンク番号を返す（進みすぎても壊さない）。
 */
export function chunkIndexAt(offsets: readonly ChunkOffset[], position: number): number {
  if (offsets.length === 0) return 0
  if (position <= 0) return 0
  for (let i = 0; i < offsets.length; i += 1) {
    const offset = offsets[i]
    if (offset && position < offset.end) return i
  }
  return offsets.length - 1
}

/** ペーサーが本文を読み終えるまでの秒数。 */
export function totalPacerSeconds(totalCharacters: number, targetCpm: number): number {
  if (targetCpm <= 0) return Infinity
  return totalCharacters / (targetCpm / 60)
}

/** 進捗（0–1）。 */
export function pacerProgress(position: number, totalCharacters: number): number {
  if (totalCharacters <= 0) return 0
  return Math.min(1, Math.max(0, position / totalCharacters))
}
