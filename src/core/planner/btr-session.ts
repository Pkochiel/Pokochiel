import { seededShuffle } from '../util/seeded-shuffle'
import {
  BTR_EXERCISES,
  btrExercise,
  btrRotationPool,
  type BtrExercise,
  type BtrStage,
} from '../training/btr/exercises'
import type { ReadingMode } from '../training/btr/paced-reading'

/**
 * 1回のトレーニングの組み立て（BTRメソッド）。
 *
 * 教室の1回は90分で、4段階を順に通す。アプリでは毎日90分は取れないので、
 * 90 / 45 / 30 / 15 分の4通りを用意し、短い回は前から詰める。
 *
 * 短くしても崩さない決まりが2つある。
 *
 *   どの長さでもサッケイドと倍速読書を入れる
 *     入口（眼）と出口（実際の読書）を欠くと、その日が何のためだったか分からなくなる
 *   認知視野と処理系は日替わりで回す
 *     1回に詰め込むより、種目を替えながら続けるほうが伸びる
 *
 * 同じ日なら同じ組み立てになる。日付を種にして選ぶので、
 * 開き直しても内容は変わらない。
 */

export const BTR_SESSION_MINUTES = [90, 45, 30, 15] as const
export type BtrSessionMinutes = (typeof BTR_SESSION_MINUTES)[number]

interface SessionShape {
  /** 準備（カウント呼吸法） */
  readonly prepare: number
  /** サッケイド */
  readonly saccade: number
  /** 認知視野から選ぶ種目数とその合計分 */
  readonly fieldCount: number
  readonly fieldMinutes: number
  /** 処理系から選ぶ種目数とその合計分 */
  readonly focusCount: number
  readonly focusMinutes: number
  /** 普通読書。0 なら省く */
  readonly normalReading: number
  readonly pacedReading: number
  /** 記録と振り返り。種目ではないのでブロックにしない。 */
  readonly review: number
}

/**
 * 長さごとの型（docs/BTR_METHOD.md §4-b）。
 *
 * 45分以下では普通読書を省き、倍速読書だけにする。
 * どちらも入れると1種目あたりが短くなりすぎ、どちらの数字も測定にならない。
 */
const SHAPES: Record<BtrSessionMinutes, SessionShape> = {
  90: { prepare: 3, saccade: 5, fieldCount: 3, fieldMinutes: 18, focusCount: 5, focusMinutes: 40, normalReading: 8, pacedReading: 12, review: 4 },
  45: { prepare: 3, saccade: 5, fieldCount: 2, fieldMinutes: 12, focusCount: 2, focusMinutes: 14, normalReading: 0, pacedReading: 10, review: 1 },
  30: { prepare: 2, saccade: 4, fieldCount: 1, fieldMinutes: 6, focusCount: 1, focusMinutes: 8, normalReading: 0, pacedReading: 9, review: 1 },
  15: { prepare: 1, saccade: 4, fieldCount: 1, fieldMinutes: 5, focusCount: 0, focusMinutes: 0, normalReading: 0, pacedReading: 5, review: 0 },
}

export interface BtrSessionBlock {
  readonly order: number
  readonly exercise: BtrExercise
  readonly stage: BtrStage
  readonly name: string
  readonly minutes: number
  /** 読書の種目だけが持つ */
  readonly mode?: ReadingMode
}

export interface BtrSession {
  readonly minutes: BtrSessionMinutes
  readonly blocks: readonly BtrSessionBlock[]
  /** 記録と振り返りに残す分 */
  readonly reviewMinutes: number
  /** ブロックの合計分。review を足すと minutes になる。 */
  readonly totalMinutes: number
}

export interface BtrSessionInput {
  readonly minutes: BtrSessionMinutes
  /** その日の種。同じ日なら同じ組み立てになる。 */
  readonly seed: string
  /**
   * 種目ごとの最終実施日（YYYY-MM-DD）。
   * 久しく触っていない種目から先に選ぶために使う。
   */
  readonly lastDoneAt?: Readonly<Partial<Record<BtrExercise, string>>>
}

/**
 * 日替わりで回す種目を選ぶ。
 *
 * 久しく触っていないものから順に取る。種だけで選ぶと、
 * 同じ種目が何日も続いたり、何週間も出てこなかったりする。
 * 最終実施日が並んだときは種で崩す（同じ日なら毎回同じ並びになる）。
 */
function rotate(
  pool: readonly BtrExercise[],
  count: number,
  seed: string,
  lastDoneAt: Readonly<Partial<Record<BtrExercise, string>>>,
): BtrExercise[] {
  if (count <= 0) return []

  const shuffled = seededShuffle(pool, `btr-rotation:${seed}`)
  // 未実施は最優先。日付は辞書順で比較できる形にしてある。
  return [...shuffled]
    .sort((a, b) => (lastDoneAt[a] ?? '').localeCompare(lastDoneAt[b] ?? ''))
    .slice(0, count)
}

/**
 * 選んだ種目に分を配る。
 *
 * 元の分数の比を保ったまま、与えられた枠に収める。
 * 均等割りにすると、2分で足りる種目と10分要る種目が同じ長さになってしまう。
 */
function share(exercises: readonly BtrExercise[], budget: number): number[] {
  if (exercises.length === 0) return []

  const natural = exercises.map((id) => btrExercise(id).minutes)
  const total = natural.reduce((sum, minutes) => sum + minutes, 0)
  if (total <= 0) return exercises.map(() => 0)

  const minutes = natural.map((value) => Math.max(1, Math.round((value * budget) / total)))
  // 丸めのずれは最後の種目で吸収する。合計が枠と食い違うと、
  // 画面に出る「合計90分」が実際と合わなくなる。
  const drift = budget - minutes.reduce((sum, value) => sum + value, 0)
  const last = minutes.length - 1
  minutes[last] = Math.max(1, minutes[last]! + drift)
  return minutes
}

export function buildBtrSession(input: BtrSessionInput): BtrSession {
  const shape = SHAPES[input.minutes]
  const lastDoneAt = input.lastDoneAt ?? {}

  const field = rotate(btrRotationPool('field'), shape.fieldCount, input.seed, lastDoneAt)
  const focus = rotate(btrRotationPool('focus'), shape.focusCount, input.seed, lastDoneAt)

  const allotted = new Map<BtrExercise, number>([
    ['breathing', shape.prepare],
    ['saccade', shape.saccade],
    ['paced_reading', shape.pacedReading],
  ])
  if (shape.normalReading > 0) allotted.set('normal_reading', shape.normalReading)

  const fieldMinutes = share(field, shape.fieldMinutes)
  for (const [index, id] of field.entries()) allotted.set(id, fieldMinutes[index] ?? 1)

  const focusMinutes = share(focus, shape.focusMinutes)
  for (const [index, id] of focus.entries()) allotted.set(id, focusMinutes[index] ?? 1)

  // 並べ直さず、種目一覧の順（眼から入って頭で終える順）のまま出す。
  const blocks: BtrSessionBlock[] = []
  for (const spec of BTR_EXERCISES) {
    const minutes = allotted.get(spec.id)
    if (minutes === undefined || minutes <= 0) continue
    blocks.push({
      order: blocks.length + 1,
      exercise: spec.id,
      stage: spec.stage,
      name: spec.name,
      minutes,
      ...(spec.mode ? { mode: spec.mode } : {}),
    })
  }

  return {
    minutes: input.minutes,
    blocks,
    reviewMinutes: shape.review,
    totalMinutes: blocks.reduce((sum, block) => sum + block.minutes, 0),
  }
}
