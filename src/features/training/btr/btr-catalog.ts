import type { ComponentType } from 'react'
import { NumberRandomBlock } from './number-random-block'
import { SaccadeBlock } from './saccade-block'

/**
 * BTR の種目の一覧。
 *
 * セッション構成の置き換え（Phase 3-F）はまだなので、
 * いまはここから1種目ずつ開いて試せるようにしている。
 */

export type BtrStage = 'prepare' | 'field' | 'focus' | 'reading'

export const BTR_STAGE_LABELS: Record<BtrStage, string> = {
  prepare: '準備',
  field: '認知視野の拡大',
  focus: '読書内容への集中',
  reading: '読書',
}

export interface BtrBlockProps {
  /** その回の課題を決める種。日付を渡す。 */
  readonly seed: string
  /** 級（0 始まり） */
  readonly level?: number
  readonly onComplete: (outcome: { score: number }) => void
}

export interface BtrEntry {
  readonly slug: string
  readonly name: string
  readonly stage: BtrStage
  readonly summary: string
  /** まだ画面ができていない種目は null。一覧には出すが開けない。 */
  readonly Component: ComponentType<BtrBlockProps> | null
}

export const BTR_CATALOG: readonly BtrEntry[] = [
  {
    slug: 'breathing',
    name: 'カウント呼吸法',
    stage: 'prepare',
    summary: '決まった時間で自分の呼吸を数える。少ないほうがよい',
    Component: null,
  },
  {
    slug: 'saccade',
    name: 'サッケイド',
    stage: 'field',
    summary: '文字を出さず、視線だけを往復させる。たて・よこは日ごとに変わる',
    Component: SaccadeBlock,
  },
  {
    slug: 'number-random',
    name: '数字ランダム',
    stage: 'field',
    summary: '散らばった 1〜99 を1から順に拾う。4枚',
    Component: NumberRandomBlock,
  },
  {
    slug: 'pattern-sheet',
    name: '漢数字一行',
    stage: 'field',
    summary: '縦書き80列から対象の漢数字を探す。3ターン',
    Component: null,
  },
  {
    slug: 'bp-sheet',
    name: 'BPシート',
    stage: 'field',
    summary: '動きの中で文字を判別する',
    Component: null,
  },
  {
    slug: 'unit-book',
    name: 'ユニットブック',
    stage: 'field',
    summary: 'よく似た8つの文から、お題の文を探す',
    Component: null,
  },
  {
    slug: 'speed-check',
    name: 'スピードチェック',
    stage: 'focus',
    summary: '方角漢字の組み合わせから対象を探す',
    Component: null,
  },
  {
    slug: 'kana-pickup',
    name: 'かなひろい',
    stage: 'focus',
    summary: '物語を読みながら、あ・い・う・え・お を拾う',
    Component: null,
  },
  {
    slug: 'logical-test',
    name: 'ロジカルテスト',
    stage: 'focus',
    summary: '前提から結論が導けるかを判定する。30問',
    Component: null,
  },
  {
    slug: 'speed-board',
    name: 'スピードボード',
    stage: 'focus',
    summary: '5×5 の盤で、真ん中からの移動の行き先を指す',
    Component: null,
  },
  {
    slug: 'image-memory',
    name: 'イメージ記憶',
    stage: 'focus',
    summary: '40語を覚えて思い出す。同じ語で2セット',
    Component: null,
  },
  {
    slug: 'reading',
    name: '普通読書 / 倍速読書',
    stage: 'reading',
    summary: '自分の本を読み、ページ数と時間を記録する',
    Component: null,
  },
]

export function findBtrEntry(slug: string): BtrEntry | null {
  return BTR_CATALOG.find((entry) => entry.slug === slug) ?? null
}
