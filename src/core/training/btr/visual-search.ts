import { createRandom, hashString } from '../../util/seeded-shuffle'

/**
 * 盤面から対象を探す課題の共通部分。
 *
 * BTRメソッドの「漢数字一行」「スピードチェック」「数字ランダム」は、
 * 並んだ記号の中から対象だけを拾い出す選択的注意の課題という点で同じ形をしている。
 * 盤面の中身と対象の決め方だけが違うので、盤の生成と採点はここに集約する。
 *
 * 盤面は日付を種にした擬似乱数で作る。同じ日なら同じ盤、翌日は別の盤になる。
 */

export interface SearchCell {
  /** 盤面での位置（0 始まり・行優先） */
  readonly index: number
  /** 表示する文字（「三」「南東」など） */
  readonly label: string
  /** 拾うべきマスか */
  readonly target: boolean
}

export interface SearchSheet {
  readonly id: string
  /** 1行あたりのマス数 */
  readonly columns: number
  readonly rows: number
  /** 探す対象の表示（「三」「南東」など） */
  readonly targetLabel: string
  /** 盤面に含まれる対象の数 */
  readonly targetCount: number
  readonly cells: readonly SearchCell[]
}

export interface BuildSearchSheetInput {
  readonly id: string
  readonly columns: number
  readonly rows: number
  /** 盤面を埋める記号の一覧。対象もこの中から選ぶ。 */
  readonly symbols: readonly string[]
  /** 探す対象 */
  readonly targetLabel: string
  /**
   * 対象が盤面に占める割合（0–1）。
   * 高すぎると探す必要がなくなり、低すぎると見つからずに時間が過ぎる。
   */
  readonly targetRatio: number
  readonly seed: string
}

/**
 * 盤面を作る。
 *
 * 対象の位置は散らす。固まっていると一度見つけたあとが作業になり、
 * 盤面を走査する訓練にならない。
 */
export function buildSearchSheet(input: BuildSearchSheetInput): SearchSheet {
  const { id, columns, rows, symbols, targetLabel, targetRatio, seed } = input
  const size = Math.max(0, columns * rows)
  if (size === 0 || symbols.length === 0) {
    return { id, columns, rows, targetLabel, targetCount: 0, cells: [] }
  }

  const random = createRandom(hashString(`${seed}:${id}:${targetLabel}`))
  const others = symbols.filter((symbol) => symbol !== targetLabel)
  const pool = others.length > 0 ? others : symbols

  const desired = Math.max(1, Math.min(size, Math.round(size * targetRatio)))
  const targetIndexes = new Set<number>()
  // 位置を引き直しながら詰める。重複したぶんは次の空きへ送る。
  let guard = 0
  while (targetIndexes.size < desired && guard < size * 8) {
    targetIndexes.add(Math.floor(random() * size))
    guard += 1
  }

  const cells: SearchCell[] = Array.from({ length: size }, (_, index) => {
    if (targetIndexes.has(index)) return { index, label: targetLabel, target: true }
    const label = pool[Math.floor(random() * pool.length)] ?? pool[0] ?? targetLabel
    return { index, label, target: false }
  })

  return { id, columns, rows, targetLabel, targetCount: targetIndexes.size, cells }
}

export interface SearchResult {
  /** 拾えた対象の数。これが主スコアになる。 */
  readonly found: number
  /** 拾い損ねた対象の数 */
  readonly missed: number
  /** 対象でないマスを拾った数 */
  readonly wrong: number
  /** 盤面にあった対象の総数 */
  readonly total: number
  /**
   * 正確さ（0–100）。found / (found + wrong)。
   * 「速いが当てずっぽう」を速さだけで評価しないための副指標。
   */
  readonly precision: number
}

/**
 * 拾ったマスの一覧から採点する。
 *
 * 同じマスを何度拾っても1回として数える（連打で稼げないようにする）。
 */
export function scoreSearch(
  sheet: SearchSheet,
  pickedIndexes: readonly number[],
): SearchResult {
  const picked = new Set(pickedIndexes)
  let found = 0
  let wrong = 0

  for (const index of picked) {
    const cell = sheet.cells[index]
    if (!cell) continue
    if (cell.target) found += 1
    else wrong += 1
  }

  const attempted = found + wrong
  return {
    found,
    missed: sheet.targetCount - found,
    wrong,
    total: sheet.targetCount,
    precision: attempted === 0 ? 0 : Math.round((found / attempted) * 100),
  }
}

/** 複数ターン・複数シートをまとめた結果。 */
export interface SearchRunResult {
  /** 各回の拾えた数。記録にはこの並びをそのまま残す（「22・20・18・24」の形）。 */
  readonly attempts: readonly number[]
  /** 合計の拾えた数 */
  readonly found: number
  readonly missed: number
  readonly wrong: number
  readonly total: number
  readonly precision: number
}

export function combineSearchResults(results: readonly SearchResult[]): SearchRunResult {
  const sum = (pick: (result: SearchResult) => number) =>
    results.reduce((total, result) => total + pick(result), 0)

  const found = sum((r) => r.found)
  const wrong = sum((r) => r.wrong)
  const attempted = found + wrong

  return {
    attempts: results.map((result) => result.found),
    found,
    missed: sum((r) => r.missed),
    wrong,
    total: sum((r) => r.total),
    precision: attempted === 0 ? 0 : Math.round((found / attempted) * 100),
  }
}
