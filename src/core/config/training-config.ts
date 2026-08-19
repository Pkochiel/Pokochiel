/**
 * トレーニングの閾値・係数はすべてこのファイルに集約する。
 * ロジック内に数値リテラルを直接書かない（Magic Number 禁止）。
 * 詳細な根拠は docs/TRAINING_LOGIC.md を参照。
 */
import type { ChunkLevel, PlanDuration } from '../types/common'
import type { TrainingType } from '../types/training'

export const READING = {
  /** これ未満の計測は invalid とする（誤タップ・スキップ対策） */
  minReadingSeconds: 3,
  /** これを超える CPM は invalid とする */
  maxPlausibleCpm: 6000,
  /** Baseline に対する初期目標速度の倍率 */
  baselineStartMultiplier: 1.15,
} as const

export const SPEED_ADAPTATION = {
  highComprehension: 0.85,
  lowComprehension: 0.7,
  increaseRate: 0.05,
  decreaseRate: 0.05,
  minMultiplierOfBaseline: 0.8,
  maxMultiplierOfBaseline: 2.5,
  /** 設問がこれ未満の回では速度を動かさない */
  minQuestionsForAdaptation: 4,
  /** 直近 N 件の実績で判定する */
  recentWindow: 5,
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

/** Daily Training のベース配分（分）。合計は totalMinutes に一致する。 */
export const PLAN = {
  presets: {
    30: {
      warmup: 3,
      speed_push: 5,
      chunk_reading: 5,
      structure_reading: 7,
      comprehension: 5,
      immediate_recall: 5,
    },
    20: {
      warmup: 2,
      speed_push: 4,
      chunk_reading: 3,
      structure_reading: 5,
      comprehension: 3,
      immediate_recall: 3,
    },
    10: {
      warmup: 1,
      speed_push: 2,
      chunk_reading: 2,
      structure_reading: 2,
      comprehension: 2,
      immediate_recall: 1,
    },
  },
  /** 総時間のこの割合までを、強いブロックから弱点ブロックへ移す */
  reallocationRatio: 0.2,
  blockMinMinutes: 1,
  /** 翌日 Recall を差し込む場合の所要分 */
  delayedRecallMinutes: 2,
  /** 直近この日数で使った教材は再利用しない */
  passageCooldownDays: 14,
} as const satisfies {
  presets: Record<PlanDuration, Partial<Record<TrainingType, number>>>
  reallocationRatio: number
  blockMinMinutes: number
  delayedRecallMinutes: number
  passageCooldownDays: number
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

/** 難易度（1–5）を DifficultyFactors から算出する際の重み。合計 1。 */
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
