import type { ComponentType } from 'react'
import {
  BTR_EXERCISES,
  BTR_STAGE_LABELS,
  type BtrExercise,
  type BtrExerciseSpec,
  type BtrStage,
} from '@/core/training/btr/exercises'
import { BpSheetBlock } from './bp-sheet-block'
import { BreathingBlock } from './breathing-block'
import { ImageMemoryBlock } from './image-memory-block'
import { KanaPickupBlock } from './kana-pickup-block'
import { LogicalTestBlock } from './logical-test-block'
import { NumberRandomBlock } from './number-random-block'
import { PatternSheetBlock } from './pattern-sheet-block'
import { ReadingBlock } from './reading-block'
import { SaccadeBlock } from './saccade-block'
import { SpeedBoardBlock } from './speed-board-block'
import { SpeedCheckBlock } from './speed-check-block'
import { UnitBookBlock } from './unit-book-block'
import type { BtrBlockProps } from './shared/btr-block'

/**
 * 種目と画面の対応。
 *
 * 種目の素性（段階・分数・級を持つか）は core が持つ。ここが持つのは
 * 「どの画面を出すか」と、一覧に見せる短い説明だけにする。
 * 二か所に一覧があると、種目を足したときにどちらかが取り残される。
 */

export type { BtrBlockProps, BtrOutcome } from './shared/btr-block'
export { BTR_STAGE_LABELS, type BtrStage } from '@/core/training/btr/exercises'

/**
 * 読書は画面がひとつで、読み方だけが違う。
 *
 * 1回の組み立ての中では普通読書と倍速読書が別々のブロックとして並ぶので、
 * ここで読み方を決めておき、走らせる側は他の種目と同じように扱えるようにする。
 */
function NormalReadingBlock(props: BtrBlockProps) {
  return <ReadingBlock {...props} mode="normal" />
}

function PacedReadingBlock(props: BtrBlockProps) {
  return <ReadingBlock {...props} mode="paced" />
}

const COMPONENTS: Record<BtrExercise, ComponentType<BtrBlockProps>> = {
  breathing: BreathingBlock,
  saccade: SaccadeBlock,
  number_random: NumberRandomBlock,
  unit_book: UnitBookBlock,
  pattern_sheet: PatternSheetBlock,
  bp_sheet: BpSheetBlock,
  speed_check: SpeedCheckBlock,
  kana_pickup: KanaPickupBlock,
  logical_test: LogicalTestBlock,
  speed_board: SpeedBoardBlock,
  image_memory: ImageMemoryBlock,
  normal_reading: NormalReadingBlock,
  paced_reading: PacedReadingBlock,
}

/** 一覧に見せる一行。何をする種目かが分かる長さにとどめる。 */
const SUMMARIES: Record<BtrExercise, string> = {
  breathing: '決まった時間で自分の呼吸を数える。少ないほうがよい',
  saccade: '文字を出さず、視線だけを往復させる。たて・よこは日ごとに変わる',
  number_random: '散らばった 1〜99 を1から順に拾う。4枚',
  unit_book: 'よく似た8つの文から、お題の文を探す',
  pattern_sheet: '縦書き80列から対象の漢数字を探す。3ターン',
  bp_sheet: '動きの中で文字を判別する',
  speed_check: '方角漢字の組み合わせから対象を探す',
  kana_pickup: '物語を読みながら、あ・い・う・え・お を拾う',
  logical_test: '前提から結論が導けるかを判定する。30問',
  speed_board: '5×5 の盤で、真ん中からの移動の行き先を指す',
  image_memory: '40語を覚えて思い出す。同じ語で2セット',
  normal_reading: '自分の本をいつもの読み方で読む。いまの速さを測る',
  paced_reading: '自分の本を意識して速く読む。こちらが訓練にあたる',
}

export interface BtrEntry {
  readonly slug: string
  readonly exercise: BtrExercise
  readonly name: string
  readonly stage: BtrStage
  readonly summary: string
  readonly Component: ComponentType<BtrBlockProps>
}

/** URL に出す名前。種目 id の下線をつなぎに替えるだけ。 */
export function btrSlug(exercise: BtrExercise): string {
  return exercise.replace(/_/g, '-')
}

function toEntry(spec: BtrExerciseSpec): BtrEntry {
  return {
    slug: btrSlug(spec.id),
    exercise: spec.id,
    name: spec.name,
    stage: spec.stage,
    summary: SUMMARIES[spec.id],
    Component: COMPONENTS[spec.id],
  }
}

export const BTR_CATALOG: readonly BtrEntry[] = BTR_EXERCISES.map(toEntry)

export function findBtrEntry(slug: string): BtrEntry | null {
  return BTR_CATALOG.find((entry) => entry.slug === slug) ?? null
}

export function btrComponentFor(exercise: BtrExercise): ComponentType<BtrBlockProps> {
  return COMPONENTS[exercise]
}
