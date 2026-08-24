import { createRandom, hashString, seededShuffle } from '../../util/seeded-shuffle'

/**
 * ユニットブック（BTRメソッド 認知視野拡大）
 *
 * 縦一行のユニットが8列並ぶ。どれもよく似た文で、位置は毎回入れ替わる。
 * お題の文がどの列にあるかを、どれだけ速く見つけられるかを見る。正解数で級を判定する。
 *
 * **お題は1セットのあいだ変わらない。** 変わるのは列の並びだけである。
 * 毎問お題を読み直す形にすると、探す時間より読む時間のほうが長くなり、
 * 「見つける速さ」を測れなくなる。
 *
 * 例（教室で使われている形）：
 *
 *   おじいさんは山へ芝刈りに行きました。
 *   おばあさんは山へ芝刈りに行きました。
 *   おじいさんは山へ芝刈りに行きません。
 *   おばあさんは山へ芝刈りに行きません。
 *   おじいさんは川へ洗たくに行きました。
 *   おばあさんは川へ洗たくに行きました。
 *   おじいさんは川へ洗たくに行きません。
 *   おばあさんは川へ洗たくに行きません。
 *
 * **8列は3つの二択の総当たり**である（だれが／どこへ・なにを／したかどうか）。
 * どの2列も1〜3か所しか違わないので、拾い読みでは当たらない。
 * 文の頭だけ見て決めると外れるところがこの種目の要点である。
 */

export const UNIT_BOOK = {
  /** 列の数。3つの二択の総当たりで 2×2×2 = 8。 */
  columns: 8,
  /** 1回の出題数 */
  questionCount: 20,
  /** 制限時間の段階（ms） */
  timeLimits: [180_000, 150_000, 120_000, 90_000, 60_000],
  /** 次の段へ上がる正答率（%） */
  advanceAccuracy: 90,
  /** ひとつ前の段へ戻る正答率（%） */
  fallbackAccuracy: 70,
} as const

/**
 * 文の型。3つの差し替え箇所を持つ。
 *
 * 教室の教材は使わないので、文はこちらで作る。
 * どの型も「差し替え箇所が3つ・各2択」という構造だけを守る。
 */
export interface UnitTemplate {
  readonly id: string
  /** 文を組み立てる。3つの二択の選択（0 or 1）を受け取る。 */
  readonly build: (choices: readonly [number, number, number]) => string
  /** 差し替え箇所の説明。デバッグと文書化のために持つ。 */
  readonly axes: readonly [readonly [string, string], readonly [string, string], readonly [string, string]]
}

const pick = (pair: readonly [string, string], choice: number) => pair[choice === 0 ? 0 : 1]

export const UNIT_TEMPLATES: readonly UnitTemplate[] = [
  {
    id: 'mountain',
    axes: [
      ['おじいさん', 'おばあさん'],
      ['山へ芝刈り', '川へ洗たく'],
      ['行きました', '行きません'],
    ],
    build: ([who, where, did]) =>
      `${pick(['おじいさん', 'おばあさん'], who)}は${pick(['山へ芝刈り', '川へ洗たく'], where)}に${pick(['行きました', '行きません'], did)}。`,
  },
  {
    id: 'shop',
    axes: [
      ['となりの店', '駅前の店'],
      ['朝から', '夕方から'],
      ['開いていました', '開いていません'],
    ],
    build: ([which, when, state]) =>
      `${pick(['となりの店', '駅前の店'], which)}は${pick(['朝から', '夕方から'], when)}${pick(['開いていました', '開いていません'], state)}。`,
  },
  {
    id: 'letter',
    axes: [
      ['兄', '姉'],
      ['手紙', '荷物'],
      ['受け取りました', '受け取れません'],
    ],
    build: ([who, what, did]) =>
      `${pick(['兄', '姉'], who)}は${pick(['手紙', '荷物'], what)}を${pick(['受け取りました', '受け取れません'], did)}。`,
  },
  {
    id: 'weather',
    axes: [
      ['きのう', 'きょう'],
      ['北のほう', '南のほう'],
      ['晴れていました', '晴れていません'],
    ],
    build: ([when, where, state]) =>
      `${pick(['きのう', 'きょう'], when)}は${pick(['北のほう', '南のほう'], where)}だけ${pick(['晴れていました', '晴れていません'], state)}。`,
  },
]

export interface UnitBookColumn {
  /** 何列目に置かれているか（0 始まり） */
  readonly position: number
  readonly text: string
}

export interface UnitBookQuestion {
  readonly id: string
  /** 画面に並べる順。position はこの並びの添字と一致する。 */
  readonly columns: readonly UnitBookColumn[]
  /** 正解の列 */
  readonly answerPosition: number
}

export interface UnitBookSet {
  /** 使った文の型 */
  readonly templateId: string
  /** 探す文。**1セットのあいだ変わらない。** */
  readonly target: string
  readonly questions: readonly UnitBookQuestion[]
}

/** 3つの二択の総当たり。8通りを固定の順で返す。 */
function allChoices(): [number, number, number][] {
  const combos: [number, number, number][] = []
  for (let a = 0; a < 2; a += 1) {
    for (let b = 0; b < 2; b += 1) {
      for (let c = 0; c < 2; c += 1) combos.push([a, b, c])
    }
  }
  return combos
}

export interface BuildUnitBookInput {
  readonly seed: string
  readonly count?: number
}

/**
 * 1セットぶんの出題を作る。
 *
 * 文の型とお題は**セットの最初に1度だけ**決める。以降の問題で変わるのは
 * 列の並びだけで、並びが毎回変わるので位置を覚えて答えることはできない。
 */
export function buildUnitBookSet(input: BuildUnitBookInput): UnitBookSet {
  const { seed, count = UNIT_BOOK.questionCount } = input
  const random = createRandom(hashString(`${seed}:unit-book`))
  const template =
    UNIT_TEMPLATES[Math.floor(random() * UNIT_TEMPLATES.length)] ?? UNIT_TEMPLATES[0]

  if (count <= 0 || template === undefined) {
    return { templateId: template?.id ?? '', target: '', questions: [] }
  }

  const texts = allChoices().map((choices) => template.build(choices))
  const target = texts[Math.floor(random() * texts.length)] ?? texts[0]!

  const questions = Array.from({ length: count }, (_, index): UnitBookQuestion => {
    const shuffled = seededShuffle(texts, `${seed}:unit-book:${index}`)
    return {
      id: `ub-${index + 1}`,
      columns: shuffled.map((text, position) => ({ position, text })),
      answerPosition: shuffled.indexOf(target),
    }
  })

  return { templateId: template.id, target, questions }
}

export interface UnitBookResult {
  readonly correct: number
  readonly wrong: number
  readonly unanswered: number
  readonly total: number
  /** 正答率（0–100）。分母は出題数。 */
  readonly accuracy: number
}

export function scoreUnitBook(
  questions: readonly UnitBookQuestion[],
  answers: ReadonlyMap<string, number>,
): UnitBookResult {
  let correct = 0
  let wrong = 0

  for (const question of questions) {
    const answer = answers.get(question.id)
    if (answer === undefined) continue
    if (answer === question.answerPosition) correct += 1
    else wrong += 1
  }

  const total = questions.length
  return {
    correct,
    wrong,
    unanswered: total - correct - wrong,
    total,
    accuracy: total === 0 ? 0 : Math.round((correct / total) * 100),
  }
}
