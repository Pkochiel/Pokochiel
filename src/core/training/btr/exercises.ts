import type { ReadingMode } from './paced-reading'

/**
 * BTR の種目一覧。
 *
 * 種目の素性（どの段階のものか、90分の配分で何分か、級を持つか）を
 * ここ一か所に置く。画面・計画・記録がそれぞれ別の一覧を持つと、
 * 種目を足したときに必ずどれかが取り残される。
 */

export type BtrExercise =
  | 'breathing'
  | 'saccade'
  | 'number_random'
  | 'pattern_sheet'
  | 'bp_sheet'
  | 'unit_book'
  | 'speed_check'
  | 'kana_pickup'
  | 'logical_test'
  | 'speed_board'
  | 'image_memory'
  | 'normal_reading'
  | 'paced_reading'

/** BTR の4段階。この順に進む。 */
export type BtrStage = 'prepare' | 'field' | 'focus' | 'reading'

export const BTR_STAGE_LABELS: Record<BtrStage, string> = {
  prepare: '準備',
  field: '認知視野の拡大',
  focus: '読書内容への集中',
  reading: '読書',
}

export interface BtrExerciseSpec {
  readonly id: BtrExercise
  readonly name: string
  readonly stage: BtrStage
  /**
   * 1回90分の配分での分数。
   *
   * 短い回では、選ばれた種目どうしの**比**を保ったまま枠に縮める。
   * 絶対値ではなく重みとして効く。
   */
  readonly minutes: number
  /**
   * 日替わりの抽選に入れず、毎回入れるか。
   *
   * 入口（眼）と出口（実際の読書）を欠くと、その日のトレーニングが
   * 何のためだったか分からなくなるので、サッケイドと倍速読書は必ず入れる。
   * 準備のカウント呼吸法も、抽選の対象にはしない。
   */
  readonly always: boolean
  /**
   * 級を持つか。
   *
   * 級とは「課される制限時間の短さ」のことなので、課す条件が変わらない種目は
   * 級を持たない。カウント呼吸法（状態の測定）、かなひろい（2分固定で
   * 拾えた数がそのまま成績）、読書（自分の本を決まった時間読む）がそれにあたる。
   */
  readonly leveled: boolean
  /** 読書の種目だけが持つ。普通読書と倍速読書を型で分ける。 */
  readonly mode?: ReadingMode
}

/**
 * 実施順。
 *
 * 眼から入って頭で終える。準備 → 眼の運動 → 走査 → 処理 → 記憶 → 実際の読書。
 * 疲れが出る前に負荷の高いものを置き、最後は実際の本で締める。
 */
export const BTR_EXERCISES: readonly BtrExerciseSpec[] = [
  { id: 'breathing', name: 'カウント呼吸法', stage: 'prepare', minutes: 3, always: true, leveled: false },
  { id: 'saccade', name: 'サッケイド', stage: 'field', minutes: 5, always: true, leveled: true },
  { id: 'number_random', name: '数字ランダム', stage: 'field', minutes: 4, always: false, leveled: true },
  { id: 'unit_book', name: 'ユニットブック', stage: 'field', minutes: 6, always: false, leveled: true },
  { id: 'pattern_sheet', name: '漢数字一行', stage: 'field', minutes: 6, always: false, leveled: true },
  { id: 'bp_sheet', name: 'BPシート', stage: 'field', minutes: 6, always: false, leveled: true },
  { id: 'speed_check', name: 'スピードチェック', stage: 'focus', minutes: 6, always: false, leveled: true },
  { id: 'kana_pickup', name: 'かなひろい', stage: 'focus', minutes: 8, always: false, leveled: false },
  { id: 'logical_test', name: 'ロジカルテスト', stage: 'focus', minutes: 8, always: false, leveled: true },
  { id: 'speed_board', name: 'スピードボード', stage: 'focus', minutes: 8, always: false, leveled: true },
  { id: 'image_memory', name: 'イメージ記憶', stage: 'focus', minutes: 10, always: false, leveled: true },
  { id: 'normal_reading', name: '普通読書', stage: 'reading', minutes: 8, always: false, leveled: false, mode: 'normal' },
  { id: 'paced_reading', name: '倍速読書', stage: 'reading', minutes: 12, always: true, leveled: false, mode: 'paced' },
]

const BY_ID = new Map(BTR_EXERCISES.map((spec) => [spec.id, spec]))

export function btrExercise(id: BtrExercise): BtrExerciseSpec {
  const spec = BY_ID.get(id)
  if (spec === undefined) throw new Error(`知らない種目です: ${id}`)
  return spec
}

export function btrExerciseName(id: BtrExercise): string {
  return btrExercise(id).name
}

/** その段階の種目を、実施順のまま返す。 */
export function btrExercisesOf(stage: BtrStage): readonly BtrExerciseSpec[] {
  return BTR_EXERCISES.filter((spec) => spec.stage === stage)
}

/**
 * 日替わりで回す種目。
 *
 * 毎回入る種目は抽選に混ぜない。混ぜると、当たらなかった日に
 * 入口（眼）か出口（実際の読書）が欠けてしまう。
 */
export function btrRotationPool(stage: BtrStage): readonly BtrExercise[] {
  return btrExercisesOf(stage)
    .filter((spec) => !spec.always)
    .map((spec) => spec.id)
}
