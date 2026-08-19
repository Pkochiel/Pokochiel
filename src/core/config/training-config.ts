/**
 * トレーニングの閾値・係数はすべてこのファイルに集約する。
 * ロジック内に数値リテラルを直接書かない（Magic Number 禁止）。
 * 詳細な根拠は docs/TRAINING_LOGIC.md を参照。
 */
import type { ChunkLevel, PlanDuration } from '../types/common'
import type { SkillId } from '../types/skill'
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

/**
 * Daily Training の配分（分）。
 *
 * 毎日必ず行う「コア」と、Skill Profile に応じて選ぶ「任意ブロック」に分ける。
 * コア + 任意の合計が totalMinutes にちょうど一致する。
 * 全トレーニングを毎日詰め込むと1つあたりが短くなりすぎるため、選択制にしている。
 */
export const PLAN = {
  core: {
    30: {
      warmup: 2,
      speed_push: 5,
      structure_reading: 6,
      comprehension: 4,
      immediate_recall: 4,
    },
    20: {
      warmup: 1,
      speed_push: 4,
      structure_reading: 4,
      comprehension: 3,
      immediate_recall: 3,
    },
    10: {
      warmup: 1,
      speed_push: 2,
      structure_reading: 2,
      comprehension: 2,
      immediate_recall: 1,
    },
  },
  /** 任意ブロックに配れる合計時間（分） */
  optionalBudget: { 30: 9, 20: 5, 10: 2 },
  /** 任意ブロック1つあたりの下限・上限（分） */
  optionalBlockMinMinutes: 2,
  optionalBlockMaxMinutes: 5,
  /** 翌日 Recall を差し込む場合の所要分（コアの外側） */
  delayedRecallMinutes: 2,
  /** 直近この日数で使った教材は再利用しない */
  passageCooldownDays: 14,
  /** コア側の配分を弱点に応じて動かす割合 */
  coreReallocationRatio: 0.2,
  coreBlockMinMinutes: 1,
  /** 供出元がベース配分のうち最低限保持する割合 */
  donorRetentionRatio: 0.5,
} as const satisfies {
  core: Record<PlanDuration, Partial<Record<TrainingType, number>>>
  optionalBudget: Record<PlanDuration, number>
  optionalBlockMinMinutes: number
  optionalBlockMaxMinutes: number
  delayedRecallMinutes: number
  passageCooldownDays: number
  coreReallocationRatio: number
  coreBlockMinMinutes: number
  donorRetentionRatio: number
}

/** 任意ブロックと、それが鍛えるスキルの対応。 */
export const OPTIONAL_TRAINING_SKILLS = {
  meaning_flash: 'meaning_extraction',
  chunk_reading: 'chunk_recognition',
  prediction_reading: 'prediction',
  variable_speed: 'adaptive_reading',
  regression_control: 'reading_speed',
} as const satisfies Partial<Record<TrainingType, SkillId>>

/** コアブロックと、それが鍛えるスキルの対応。 */
export const CORE_TRAINING_SKILLS = {
  speed_push: 'reading_speed',
  structure_reading: 'structure_recognition',
  comprehension: 'comprehension',
  immediate_recall: 'immediate_recall',
} as const satisfies Partial<Record<TrainingType, SkillId>>

/** スキル状態（unmeasured / weak / normal / strong）の判定基準。 */
export const SKILL = {
  /** これ未満のサンプル数では判定しない（未測定として扱う） */
  minSamples: 2,
  /** 傾向（trend）を出すのに必要なサンプル数 */
  minSamplesForTrend: 4,
  /** 傾向の算出に使う直近サンプル数 */
  trendWindow: 6,
  /** これ未満なら weak */
  weakBelow: 55,
  /** これ以上なら strong */
  strongAtOrAbove: 80,
  /** レベル1でも 0 にはしない下限係数 */
  minLevelFactor: 0.6,
  /** レベルが記録されていない場合の係数 */
  defaultLevelFactor: 0.8,
} as const

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

export const PREDICTION = {
  /** 選択式の予測が当たったときの得点（0–100） */
  correctScore: 100,
  /** 論理方向は合っているが論点がずれている場合 */
  partialScore: 50,
  /** 外れ */
  missScore: 0,
  /** 自由記述を書いた場合の加点（予測を言語化したこと自体を評価する） */
  writtenBonus: 10,
  maxScore: 100,
} as const

export const VARIABLE_SPEED = {
  /** 速度帯ごとの CPM 倍率（目標速度に対する比） */
  bandMultiplier: {
    slow: 0.7,
    normal: 1,
    fast: 1.4,
  },
  /** 推奨帯と一致したときの得点 */
  exactScore: 100,
  /** 隣接する帯（normal ↔ fast など）を選んだときの得点 */
  adjacentScore: 50,
  /** 正反対の帯を選んだときの得点 */
  oppositeScore: 0,
  /** 重要度の高い区間を速く読み飛ばした場合の追加減点 */
  criticalSkipPenalty: 20,
} as const

export const REGRESSION = {
  /** 1000字あたりの読み戻り回数がこれ以下なら「抑制できている」 */
  goodBackPerKiloChars: 3,
  /** これを超えると読み戻りが多いと判定する */
  highBackPerKiloChars: 8,
  /** 読み戻りが減っても理解度がこれ以上落ちていれば速度過剰と判断する */
  comprehensionDropThreshold: 15,
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
