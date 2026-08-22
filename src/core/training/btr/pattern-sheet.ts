import { createRandom, hashString } from '../../util/seeded-shuffle'

/**
 * パターンシート（BTRメソッド 認知視野拡大）
 *
 * **パターンシートは種目ではなくシートの形式である。**
 * 教室の教材は「漢数字一行パターンシート」という名前で、
 * 漢数字を使うのはその1種類にあたる。
 *
 * 形式（実物のシートから読み取ったもの）：
 *
 * - 縦書きの列が並ぶ。1列がひとつのユニットで、これが「一行」
 * - 列には5刻みの番号が振ってあり、80まである
 * - 使う字は **〇一二三四五六七八九** の10種。漢数字の「桁」であって、一〜十ではない
 * - 列は上下2段に折り返して並ぶ
 *
 * 対象の字を探すターンを繰り返す（一を探す、二を探す、三を探す。各90秒）。
 */

/**
 * 漢数字の桁。**〇を含む10種。**
 *
 * 実物のシートには 〇 が頻出する。一〜十ではなく、0〜9 にあたる10文字である。
 */
export const KANJI_DIGITS = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九'] as const

export const PATTERN_SHEET = {
  /** 列の総数。実物のシートは5刻みの番号が80まで振られている。 */
  columnCount: 80,
  /** 1列に並ぶ字数 */
  charsPerColumn: 10,
  /** 番号を振る間隔 */
  markEvery: 5,
  /** 上下に折り返す段の数 */
  bands: 2,
  /** ターンごとに探す対象。この順で行う。 */
  targets: ['一', '二', '三'] as const,
  /** 1ターンの制限時間（ms） */
  turnMs: 90_000,
} as const

export interface PatternCell {
  /** 列の中の位置（0 始まり・上から） */
  readonly row: number
  readonly label: string
  readonly target: boolean
}

export interface PatternColumn {
  /** 列番号（1 始まり）。実物のシートと同じ数え方。 */
  readonly number: number
  /** 上下どちらの段か（0 始まり） */
  readonly band: number
  readonly cells: readonly PatternCell[]
  /** この列に含まれる対象の数 */
  readonly targetCount: number
}

export interface PatternSheet {
  readonly id: string
  readonly targetLabel: string
  readonly columns: readonly PatternColumn[]
  readonly targetCount: number
}

export interface BuildPatternSheetInput {
  readonly seed: string
  readonly targetLabel: string
  readonly columnCount?: number
  readonly charsPerColumn?: number
  readonly bands?: number
}

/**
 * シートを作る。
 *
 * 字は10種から一様に引く。対象だけを多めに置くようなことはしない。
 * 実物のシートも数字の並びに偏りがあるようには見えず、
 * 「対象が何個あるか分からないまま探す」ことがこの課題の前提だと考えられる。
 */
export function buildPatternSheet(input: BuildPatternSheetInput): PatternSheet {
  const {
    seed,
    targetLabel,
    columnCount = PATTERN_SHEET.columnCount,
    charsPerColumn = PATTERN_SHEET.charsPerColumn,
    bands = PATTERN_SHEET.bands,
  } = input

  if (columnCount <= 0 || charsPerColumn <= 0) {
    return { id: `pattern-${targetLabel}`, targetLabel, columns: [], targetCount: 0 }
  }

  const random = createRandom(hashString(`${seed}:pattern:${targetLabel}`))
  const perBand = Math.ceil(columnCount / Math.max(1, bands))
  let targetCount = 0

  const columns = Array.from({ length: columnCount }, (_, index): PatternColumn => {
    let columnTargets = 0
    const cells = Array.from({ length: charsPerColumn }, (_, row): PatternCell => {
      const label = KANJI_DIGITS[Math.floor(random() * KANJI_DIGITS.length)] ?? KANJI_DIGITS[0]
      const target = label === targetLabel
      if (target) columnTargets += 1
      return { row, label, target }
    })

    targetCount += columnTargets
    return {
      number: index + 1,
      band: Math.floor(index / perBand),
      cells,
      targetCount: columnTargets,
    }
  })

  return { id: `pattern-${targetLabel}`, targetLabel, columns, targetCount }
}

/** 3ターンぶんのシート。 */
export function buildPatternSheets(seed: string): PatternSheet[] {
  return PATTERN_SHEET.targets.map((target) =>
    buildPatternSheet({ seed, targetLabel: target }),
  )
}

/** 列に番号を振るか（5刻み）。 */
export function isMarkedColumn(columnNumber: number): boolean {
  return columnNumber % PATTERN_SHEET.markEvery === 0
}

/** 拾ったマスの指定。列番号と列内の位置で表す。 */
export interface PatternPick {
  readonly column: number
  readonly row: number
}

export interface PatternResult {
  /** 拾えた対象の数 */
  readonly found: number
  readonly missed: number
  readonly wrong: number
  readonly total: number
  /**
   * どこまで進んだか（列番号）。
   * 実物のシートに5刻みの番号が振ってあるのは、到達した列を読み取るためだと考えられる。
   */
  readonly reachedColumn: number
  /** 正確さ（0–100） */
  readonly precision: number
}

export function scorePatternSheet(
  sheet: PatternSheet,
  picks: readonly PatternPick[],
): PatternResult {
  const seen = new Set<string>()
  let found = 0
  let wrong = 0
  let reachedColumn = 0

  for (const pick of picks) {
    const key = `${pick.column}:${pick.row}`
    if (seen.has(key)) continue
    seen.add(key)

    const column = sheet.columns.find((candidate) => candidate.number === pick.column)
    const cell = column?.cells[pick.row]
    if (!column || !cell) continue

    if (cell.target) {
      found += 1
      reachedColumn = Math.max(reachedColumn, column.number)
    } else {
      wrong += 1
    }
  }

  const attempted = found + wrong
  return {
    found,
    missed: sheet.targetCount - found,
    wrong,
    total: sheet.targetCount,
    reachedColumn,
    precision: attempted === 0 ? 0 : Math.round((found / attempted) * 100),
  }
}
