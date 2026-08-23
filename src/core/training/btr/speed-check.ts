import { seededShuffle } from '../../util/seeded-shuffle'

/**
 * スピードチェック（BTRメソッド 読書内容への集中）
 *
 * 方角漢字を並べた **3文字の組み合わせ** の中から、お題と同じものを探す。
 * 似た字面が大量に並ぶので、字形ではなく組み合わせとして掴む必要がある。
 *
 * **お題は1問ごとに変わる。** 同じお題が続くと、2問目からは覚えた形を
 * 照合するだけになり、組み合わせを掴み直す訓練にならない。
 * 64通りあるので、1回ぶん（30問）は重複なしで配れる。
 *
 * 選択肢はお題に近いものから埋める。1字だけ違うものを全部入れてあるので、
 * 頭の1字だけ見て決めると必ず外れる。
 *
 * 教室の教材は使わない。組み合わせは日付を種にして作る。
 */

/** スピードチェックで使う方角漢字。 */
export const DIRECTION_KANJI = ['東', '西', '南', '北'] as const

export const SPEED_CHECK = {
  /** お題の字数 */
  length: 3,
  /** 1問に並べる選択肢の数 */
  optionCount: 25,
  /** 1回の出題数 */
  questionCount: 30,
  /**
   * 制限時間の段階（ms）。短くなるほど上の段。
   *
   * 30問なので、いちばん下の段で1問あたり5秒、いちばん上で2.3秒。
   * 下の段を詰めすぎると、始めた人が最初の回から時間切れになり、
   * 正答率（分母は全問）が届かないまま下の段に留まりつづける。
   */
  timeLimits: [150_000, 120_000, 100_000, 85_000, 70_000],
  /** 次の段へ上がる正答率（%） */
  advanceAccuracy: 90,
  /** ひとつ前の段へ戻る正答率（%） */
  fallbackAccuracy: 70,
} as const

/**
 * 方角漢字の組み合わせをすべて作る。
 *
 * 同じ字の重なり（東東西）も含める。3字で重なりを禁じると
 * 4×3×2 = 24 通りしか作れず、選択肢を並べるのに足りない。
 * 重なりがあるほうが字面でも掴みにくく、課題としても素直である。
 */
export function allDirectionCombos(length: number = SPEED_CHECK.length): string[] {
  if (length <= 0) return []

  let combos: string[] = ['']
  for (let position = 0; position < length; position += 1) {
    combos = combos.flatMap((prefix) => DIRECTION_KANJI.map((kanji) => prefix + kanji))
  }
  return combos
}

/** 2つの組み合わせで、違う位置の数。 */
export function comboDistance(left: string, right: string): number {
  const a = [...left]
  const b = [...right]
  const length = Math.max(a.length, b.length)
  let distance = 0
  for (let i = 0; i < length; i += 1) {
    if (a[i] !== b[i]) distance += 1
  }
  return distance
}

export interface SpeedCheckOption {
  /** 画面での位置（0 始まり） */
  readonly position: number
  readonly label: string
}

export interface SpeedCheckQuestion {
  readonly id: string
  /** 探す組み合わせ。1問ごとに変わる。 */
  readonly target: string
  readonly options: readonly SpeedCheckOption[]
  readonly answerPosition: number
}

export interface BuildSpeedCheckInput {
  readonly seed: string
  readonly count?: number
  readonly optionCount?: number
}

/**
 * 出題を作る。
 *
 * 選択肢はお題との違いが少ないものから詰める。
 * 1字違いを全部入れてあるので、頭の1字だけ見て決めると必ず外れる。
 */
export function buildSpeedCheckQuestions(
  input: BuildSpeedCheckInput,
): SpeedCheckQuestion[] {
  const {
    seed,
    count = SPEED_CHECK.questionCount,
    optionCount = SPEED_CHECK.optionCount,
  } = input
  if (count <= 0 || optionCount <= 0) return []

  const all = allDirectionCombos()

  // お題は重複させずに配る。組み合わせより多く求められたら、
  // 並べ替え直してもう一巡する（同じ順に並ばないように種を変える）。
  const targets: string[] = []
  for (let round = 0; targets.length < count; round += 1) {
    targets.push(...seededShuffle(all, `${seed}:speed-check:targets:${round}`))
  }

  return Array.from({ length: count }, (_, index): SpeedCheckQuestion => {
    const target = targets[index]!

    // お題に近いものから詰める。同じ距離の中は種で並べ替えて、
    // 毎回同じ顔ぶれにならないようにする。
    const byDistance = new Map<number, string[]>()
    for (const combo of all) {
      if (combo === target) continue
      const distance = comboDistance(combo, target)
      const bucket = byDistance.get(distance)
      if (bucket) bucket.push(combo)
      else byDistance.set(distance, [combo])
    }

    const distractors: string[] = []
    for (const distance of [...byDistance.keys()].sort((a, b) => a - b)) {
      if (distractors.length >= optionCount - 1) break
      const bucket = seededShuffle(byDistance.get(distance) ?? [], `${seed}:sc:${index}:${distance}`)
      distractors.push(...bucket.slice(0, optionCount - 1 - distractors.length))
    }

    const labels = seededShuffle([target, ...distractors], `${seed}:sc:place:${index}`)
    return {
      id: `sc-${index + 1}`,
      target,
      options: labels.map((label, position) => ({ position, label })),
      answerPosition: labels.indexOf(target),
    }
  })
}

export interface SpeedCheckResult {
  readonly correct: number
  readonly wrong: number
  readonly unanswered: number
  readonly total: number
  /** 正答率（0–100）。分母は出題数。 */
  readonly accuracy: number
}

export function scoreSpeedCheck(
  questions: readonly SpeedCheckQuestion[],
  answers: ReadonlyMap<string, number>,
): SpeedCheckResult {
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
