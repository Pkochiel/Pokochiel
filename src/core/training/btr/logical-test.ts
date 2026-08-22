import { createRandom, hashString } from '../../util/seeded-shuffle'

/**
 * ロジカルテスト（BTRメソッド 読書内容への集中）
 *
 * 前提から結論が導けるかを高速で判定する。30問・制限時間つき。
 * 出題は順序関係の推論と三段論法の2種類。
 *
 *   順序関係  「A は B より背が高い」「B は C より背が高い」→「A は C より背が高い」
 *   三段論法  「すべての A は B」「すべての B は C」→「すべての A は C」
 *
 * 前提がつながらない出題を必ず混ぜる。
 * 「A は B より背が高い」「C は D より背が低い」から A と C の関係は決まらない。
 * ここで「判断できない」を選べるかが、この種目の核心である。
 * 正解が2択（正しい／誤り）だと当てずっぽうで半分当たってしまう。
 */

export type LogicalAnswer = 'true' | 'false' | 'unknown'
export type LogicalForm = 'ordering' | 'syllogism'

export interface LogicalQuestion {
  readonly id: string
  readonly form: LogicalForm
  /** 前提。上から順に読ませる。 */
  readonly premises: readonly string[]
  /** 判定させる結論 */
  readonly conclusion: string
  readonly answer: LogicalAnswer
}

export const LOGICAL_ANSWER_LABELS: Record<LogicalAnswer, string> = {
  true: '正しい',
  false: '誤り',
  unknown: '判断できない',
}

export const LOGICAL_TEST = {
  /** 1回の出題数 */
  questionCount: 30,
  /**
   * 制限時間の段階（ms）。基準を超えたら次に短いものへ。
   * 教室のトップ層は30問を1分30秒で終える。そこを最短の段に置く。
   */
  timeLimits: [300_000, 240_000, 180_000, 150_000, 120_000, 90_000],
  /** 次の段へ上がる正答率（%） */
  advanceAccuracy: 90,
  /** ひとつ前の段へ戻る正答率（%） */
  fallbackAccuracy: 70,
} as const

/** 順序関係で使う人物名。字面で取り違えないよう1文字ずつ離す。 */
const NAMES = ['あきら', 'いずみ', 'うたの', 'えいじ', 'おさむ', 'かなえ', 'きよし', 'くるみ'] as const

/** 順序関係の軸。比較の向きが変わっても解けるか見るため複数用意する。 */
const ORDER_AXES = [
  { noun: '背', high: '高い', low: '低い' },
  { noun: '年齢', high: '上', low: '下' },
  { noun: '足', high: '速い', low: '遅い' },
] as const

/** 三段論法で使う集合名。 */
const CATEGORIES = [
  'この工場の製品',
  '検査を通ったもの',
  '出荷されるもの',
  '返品されたもの',
  '記録が残るもの',
  '再検査の対象',
] as const

type Random = () => number

function pick<T>(items: readonly T[], random: Random): T {
  const index = Math.floor(random() * items.length)
  return items[index] ?? (items[0] as T)
}

/** 重複しない n 件を取り出す。 */
function pickMany<T>(items: readonly T[], count: number, random: Random): T[] {
  const pool = [...items]
  const chosen: T[] = []
  for (let i = 0; i < count && pool.length > 0; i += 1) {
    const index = Math.floor(random() * pool.length)
    const [taken] = pool.splice(index, 1)
    if (taken !== undefined) chosen.push(taken)
  }
  return chosen
}

/**
 * 順序関係の問題。
 *
 * つながる形（A>B, B>C）と、つながらない形（A>B, C>D）を作り分ける。
 * つながる場合は結論を正しくも誤りにもできる。つながらない場合は必ず「判断できない」。
 */
function buildOrdering(id: string, random: Random): LogicalQuestion {
  const axis = pick(ORDER_AXES, random)
  const [a, b, c, d] = pickMany(NAMES, 4, random)
  if (!a || !b || !c || !d) throw new Error('人物名が足りません')

  const compare = (left: string, right: string, higher: boolean) =>
    `${left}は${right}より${axis.noun}が${higher ? axis.high : axis.low}`

  // 3通りを均等に出す。「判断できない」だけが多いと形だけで見抜かれる。
  const shape = Math.floor(random() * 3)

  if (shape === 0) {
    // つながる ＆ 結論が正しい： A>B, B>C ⇒ A>C
    return {
      id,
      form: 'ordering',
      premises: [compare(a, b, true), compare(b, c, true)],
      conclusion: compare(a, c, true),
      answer: 'true',
    }
  }

  if (shape === 1) {
    // つながる ＆ 結論が逆： A>B, B>C ⇒ 「C>A」は誤り
    return {
      id,
      form: 'ordering',
      premises: [compare(a, b, true), compare(b, c, true)],
      conclusion: compare(c, a, true),
      answer: 'false',
    }
  }

  // つながらない： A>B, C>D から A と C の関係は決まらない
  return {
    id,
    form: 'ordering',
    premises: [compare(a, b, true), compare(c, d, false)],
    conclusion: compare(a, c, true),
    answer: 'unknown',
  }
}

/**
 * 三段論法の問題。
 *
 * 「すべての A は B」「すべての B は C」⇒「すべての A は C」は成り立つ。
 * 逆向きの「すべての C は A」は成り立たない（後件肯定）。
 * 「ある A は C でない」は前提と両立しないので誤り。
 */
function buildSyllogism(id: string, random: Random): LogicalQuestion {
  const [a, b, c] = pickMany(CATEGORIES, 3, random)
  if (!a || !b || !c) throw new Error('集合名が足りません')

  const premises = [`すべての${a}は${b}である`, `すべての${b}は${c}である`]
  const shape = Math.floor(random() * 3)

  if (shape === 0) {
    return { id, form: 'syllogism', premises, conclusion: `すべての${a}は${c}である`, answer: 'true' }
  }

  if (shape === 1) {
    // 前提と矛盾するので誤り
    return {
      id,
      form: 'syllogism',
      premises,
      conclusion: `${a}のなかに${c}でないものがある`,
      answer: 'false',
    }
  }

  // 逆は導けない（後件肯定）
  return {
    id,
    form: 'syllogism',
    premises,
    conclusion: `すべての${c}は${a}である`,
    answer: 'unknown',
  }
}

/**
 * 出題を作る。
 *
 * 同じ種から常に同じ問題が出る（画面を開き直しても課題が変わらない）。
 * 順序関係と三段論法を交互に混ぜ、片方の型に慣れて解けるだけにしない。
 */
export function buildLogicalQuestions(
  seed: string,
  count: number = LOGICAL_TEST.questionCount,
): LogicalQuestion[] {
  if (count <= 0) return []
  const random = createRandom(hashString(`${seed}:logical`))

  return Array.from({ length: count }, (_, index) => {
    const id = `lg-${index + 1}`
    return index % 2 === 0 ? buildOrdering(id, random) : buildSyllogism(id, random)
  })
}

export interface LogicalResult {
  readonly correct: number
  readonly wrong: number
  readonly unanswered: number
  readonly total: number
  /** 正答率（0–100） */
  readonly accuracy: number
}

export function scoreLogicalTest(
  questions: readonly LogicalQuestion[],
  answers: ReadonlyMap<string, LogicalAnswer>,
): LogicalResult {
  let correct = 0
  let wrong = 0

  for (const question of questions) {
    const answer = answers.get(question.id)
    if (answer === undefined) continue
    if (answer === question.answer) correct += 1
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
