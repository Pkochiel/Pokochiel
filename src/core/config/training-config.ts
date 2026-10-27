/**
 * トレーニングの閾値・係数はすべてこのファイルに集約する。
 * ロジック内に数値リテラルを直接書かない（Magic Number 禁止）。
 * 詳細な根拠は docs/TRAINING_LOGIC.md を参照。
 */
import type { ChunkLevel } from '../types/common'

export const READING = {
  /** これ未満の計測は invalid とする（誤タップ・スキップ対策）。文字数によらない絶対下限。 */
  minReadingSeconds: 3,
  /**
   * これを超える CPM は invalid とする。
   *
   * 日本語の黙読は一般に 400〜600 字/分、訓練者でも 1,000〜1,500 字/分。
   * 3,000 字/分はその倍以上であり、「読んで理解した」と言える範囲の外側にある。
   * 実効的にはこの上限が**文字数に比例した最短有効時間**として働く
   * （1,200 字なら 24 秒）。詳細は docs/METRICS.md を参照。
   */
  maxPlausibleCpm: 3000,
  /** Baseline に対する初期目標速度の倍率 */
  baselineStartMultiplier: 1.15,
} as const

export const RECALL = {
  selfAssessmentSteps: [0, 25, 50, 75, 100] as const,
  /** MVP は翌日のみ。将来 [1, 3, 7] に拡張する */
  intervalsDays: [1] as const,
  /** scheduledDate から何日で expired にするか */
  windowDays: 3,
  /** これ未満なら Recall / Structure の配分を増やす */
  lowRecallThreshold: 50,
} as const

export const CHUNKING = {
  levels: {
    1: { kind: 'chars', minChars: 5, maxChars: 8 },
    2: { kind: 'chars', minChars: 8, maxChars: 15 },
    3: { kind: 'chars', minChars: 15, maxChars: 25 },
    4: { kind: 'units', unitsPerChunk: 1 },
    5: { kind: 'units', unitsPerChunk: 3 },
  },
  /** 光感受性発作リスク帯（毎秒3回超の明滅）を避けるための安全下限。設定で下回れない。 */
  minDisplayMs: 250,
  maxDisplayMs: 4000,
  levelUpAccuracy: 0.85,
  levelDownAccuracy: 0.6,
  defaultLevel: 2,
} as const satisfies {
  levels: Record<ChunkLevel, { kind: 'chars' | 'units' } & Record<string, unknown>>
  minDisplayMs: number
  maxDisplayMs: number
  levelUpAccuracy: number
  levelDownAccuracy: number
  defaultLevel: ChunkLevel
}

export const SCORING = {
  comprehensionPassThreshold: 70,
  recentWindow: 5,
  /** Skill Radar の Reading Speed 軸で baseline の何倍を 100 点とするか */
  skillRadarSpeedCeiling: 2.0,
  /** Recall 軸における翌日想起の重み（残りが直後想起） */
  delayedRecallWeight: 0.6,
  /** 有効サンプルがこれ未満の軸は中央値扱いにする */
  minSamplesPerAxis: 2,
  /** サンプル不足時に使う中央値 */
  neutralScore: 50,
} as const

export const MEANING_FLASH = {
  /**
   * レベル別の表示時間（ms）。
   * 極端なフラッシュ表示は行わない。下限は Chunk Reading と同じ安全域に置く。
   */
  exposureMsByLevel: {
    1: 3000,
    2: 2000,
    3: 1400,
    4: 1100,
    5: 900,
  },
  /** これを下回る表示時間は設定しない（視認性と安全性の下限） */
  minExposureMs: 800,
  /** 1回のトレーニングで扱う件数 */
  itemsPerSession: 5,
  /** 表示前のカウントダウン（ms）。不意打ちの表示にしない */
  readyDelayMs: 1200,
  levelUpAccuracy: 0.85,
  levelDownAccuracy: 0.55,
  defaultLevel: 2,
} as const satisfies {
  exposureMsByLevel: Record<ChunkLevel, number>
  minExposureMs: number
  itemsPerSession: number
  readyDelayMs: number
  levelUpAccuracy: number
  levelDownAccuracy: number
  defaultLevel: ChunkLevel
}

export const DIFFICULTY_WEIGHTS = {
  vocabulary: 0.2,
  sentenceLength: 0.15,
  abstraction: 0.2,
  informationDensity: 0.15,
  logicalStructure: 0.15,
  domainSpecificity: 0.15,
} as const

/** 教材が満たすべき設問要件（Step 4 のデータ検証で使用） */
export const CONTENT_REQUIREMENTS = {
  minQuestions: 5,
  minQuestionTypes: 4,
  requiredQuestionType: 'inference',
  minKeyPoints: 3,
  maxKeyPoints: 5,
  minParagraphs: 3,
} as const
