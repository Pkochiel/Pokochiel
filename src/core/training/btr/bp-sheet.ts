import { createRandom, hashString } from '../../util/seeded-shuffle'

/**
 * BPシート（BTRメソッド 認知視野拡大）
 *
 * **動きの中で文字を判別する。**
 * 止まった盤面を走査する数字ランダムの、動く版にあたる。
 *
 * スクールの説明では、シート訓練は次の順に難しくなる。
 *
 *   ページ全体から文字を判別（ランダムシート）
 *   → **動きの中で文字を判別（BPシート）**
 *   → 動きの中で文章を判別（たて一行ユニット ＝ ユニットブック）
 *
 * 「BP」が何の略かは分からなかった。分かったら名前を直す。
 * 動きの速さ・出し方は推定であり、実物と違う可能性がある。
 */

export const BP_SHEET = {
  /** 1回に流す文字の数 */
  itemCount: 60,
  /** 文字が現れてから消えるまで（ms）の段階。級が上がるほど短くなる。 */
  lifetimeMs: [2400, 2000, 1600, 1300, 1000],
  /** 次の文字が現れるまでの間隔（ms）。滞留数を一定に保つため lifetime に比例させる。 */
  spawnRatio: 1 / 3,
  /** 対象が全体に占める割合 */
  targetRatio: 0.25,
  /** 次の段へ上がる正答率（%） */
  advanceAccuracy: 85,
  /** ひとつ前の段へ戻る正答率（%） */
  fallbackAccuracy: 60,
} as const

/** 盤面に流す文字。字形が紛れるものを選び、形で判別させる。 */
export const BP_SYMBOLS = ['あ', 'お', 'ぬ', 'め', 'は', 'ほ', 'れ', 'わ', 'ろ', 'る'] as const

export interface BpItem {
  readonly id: string
  readonly label: string
  readonly target: boolean
  /** 現れる時刻（ブロック開始からの ms） */
  readonly appearsAtMs: number
  /** 消える時刻 */
  readonly disappearsAtMs: number
  /** 現れる位置（0–1）。描画側が幅・高さに掛けて使う。 */
  readonly x: number
  readonly y: number
}

export interface BpSheet {
  readonly targetLabel: string
  readonly lifetimeMs: number
  readonly items: readonly BpItem[]
  readonly targetCount: number
  /** 最後の文字が消えるまでの長さ（ms） */
  readonly durationMs: number
}

export interface BuildBpSheetInput {
  readonly seed: string
  /** 級（0 始まり）。文字の滞留時間がこれで決まる。 */
  readonly level?: number
  readonly count?: number
}

/**
 * 流す文字の予定表を作る。
 *
 * 位置は毎回ばらす。同じところに出続けると視線が固定され、
 * 「動きの中で判別する」課題にならない。
 */
export function buildBpSheet(input: BuildBpSheetInput): BpSheet {
  const { seed, level = 0, count = BP_SHEET.itemCount } = input

  const lifetimeMs =
    BP_SHEET.lifetimeMs[Math.min(level, BP_SHEET.lifetimeMs.length - 1)] ??
    BP_SHEET.lifetimeMs[0] ??
    2000
  const spawnMs = Math.round(lifetimeMs * BP_SHEET.spawnRatio)

  if (count <= 0) {
    return { targetLabel: BP_SYMBOLS[0], lifetimeMs, items: [], targetCount: 0, durationMs: 0 }
  }

  const random = createRandom(hashString(`${seed}:bp-sheet:${level}`))
  const targetLabel = BP_SYMBOLS[Math.floor(random() * BP_SYMBOLS.length)] ?? BP_SYMBOLS[0]
  const others = BP_SYMBOLS.filter((symbol) => symbol !== targetLabel)

  let targetCount = 0
  const items = Array.from({ length: count }, (_, index): BpItem => {
    const target = random() < BP_SHEET.targetRatio
    if (target) targetCount += 1
    const appearsAtMs = index * spawnMs
    return {
      id: `bp-${index + 1}`,
      label: target ? targetLabel : (others[Math.floor(random() * others.length)] ?? others[0]!),
      target,
      appearsAtMs,
      disappearsAtMs: appearsAtMs + lifetimeMs,
      // 端に寄りすぎると読めないので中央寄りに収める。
      x: 0.08 + random() * 0.84,
      y: 0.08 + random() * 0.84,
    }
  })

  const durationMs = items.at(-1)?.disappearsAtMs ?? 0
  return { targetLabel, lifetimeMs, items, targetCount, durationMs }
}

export interface BpResult {
  /** 対象を消えるまでに拾えた数。これが主スコア。 */
  readonly found: number
  /** 拾い損ねた対象の数 */
  readonly missed: number
  /** 対象でない文字を拾った数 */
  readonly wrong: number
  readonly total: number
  /** 正確さ（0–100）。found / (found + wrong)。 */
  readonly precision: number
}

/**
 * 拾った文字の id から採点する。
 *
 * 同じ文字を何度拾っても1回として数える。
 * 「消える前に拾えたか」は UI 側が判断する（消えたあとは押せない）。
 */
export function scoreBpSheet(sheet: BpSheet, pickedIds: readonly string[]): BpResult {
  const picked = new Set(pickedIds)
  let found = 0
  let wrong = 0

  for (const item of sheet.items) {
    if (!picked.has(item.id)) continue
    if (item.target) found += 1
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
