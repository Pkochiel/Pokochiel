import { seededShuffle } from '../../util/seeded-shuffle'

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
 * - **1列は10字で、10種がちょうど1回ずつ入る**（列ごとの並べ替え）
 * - 列は上下2段に折り返して並ぶ
 *
 * 対象の字を探すターンを繰り返す（一を探す、二を探す、三を探す。各90秒）。
 * **3ターンとも同じシートを使う。** 1列に10種が1回ずつ入っているので、
 * 同じ紙のまま探す字だけを替えられる。
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
  /**
   * 級を上げるのに要る、シート全体に対する割合。
   *
   * 1列に対象がちょうど1つある以上、拾えた数はそのまま到達した列数になる。
   * 全列を90秒で終えるのが上限なので、そこからの割合で置いた。
   * **この2つの数字は暫定である。** 教室の基準は確認できていない。
   */
  advanceRatio: 0.6,
  fallbackRatio: 0.25,
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
 * **1列には10種がちょうど1回ずつ入る。** 1列が10字で字の種類も10種なので、
 * 列ごとに並べ替えたものを置く。
 *
 * 10種から毎回引く形にすると、対象の字が1つも無い列や、同じ字が2つ入る列ができる。
 * そうなると「列を順に見ていって対象を1つ見つけたら次の列へ」という進み方が成立せず、
 * 列に振ってある5刻みの番号も意味を失う。
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

  const perBand = Math.ceil(columnCount / Math.max(1, bands))
  let targetCount = 0

  const columns = Array.from({ length: columnCount }, (_, index): PatternColumn => {
    // 列ごとに10種を並べ替える。字数が種類数より多ければ、足りない分は
    // もう一巡させる（実物は10字ちょうどなので、通常は一巡で収まる）。
    const labels: string[] = []
    for (let round = 0; labels.length < charsPerColumn; round += 1) {
      labels.push(...seededShuffle(KANJI_DIGITS, `${seed}:pattern:${index}:${round}`))
    }

    let columnTargets = 0
    const cells = labels.slice(0, charsPerColumn).map((label, row): PatternCell => {
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

/**
 * 3ターンぶんのシート。
 *
 * 並びは3つとも同じで、対象の印だけが違う。教室と同じく1枚の紙を3回見る形になる。
 */
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
