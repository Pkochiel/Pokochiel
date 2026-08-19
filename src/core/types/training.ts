import type { ChunkLevel, Difficulty, LocalDate } from './common'
import type { QuestionType } from './passage'

export type TrainingType =
  | 'warmup'
  | 'speed_push'
  | 'chunk_reading'
  | 'meaning_flash'
  | 'structure_reading'
  | 'prediction_reading'
  | 'variable_speed'
  | 'regression_control'
  | 'comprehension'
  | 'immediate_recall'
  | 'delayed_recall'

export type SessionType = 'baseline' | 'daily' | 'single' | 'recall'

export interface TrainingSession {
  id: string
  userId: string
  startedAt: string
  completedAt: string | null
  durationSeconds: number | null
  sessionType: SessionType
  localDate: LocalDate
}

export interface TrainingResult {
  id: string
  userId: string
  sessionId: string
  trainingType: TrainingType
  passageId: string | null
  cpm: number | null
  /** 0–100 */
  comprehensionScore: number | null
  /** 0–100 */
  immediateRecallScore: number | null
  /** 0–100 */
  delayedRecallScore: number | null
  targetCpm: number | null
  backCount: number | null
  pauseCount: number | null
  /**
   * そのトレーニングのレベル（Chunk Reading / Meaning Flash など）。
   * 旧データの chunkLevel はここへ移送される。
   */
  level: ChunkLevel | null
  difficulty: Difficulty | null
  /**
   * そのトレーニング固有の正答率・一致率（0–100）。
   * Meaning Flash の意味把握、Prediction の予測妥当性、
   * Variable Speed の推奨速度との一致率がここに入る。
   * 「文章の理解度」を表す comprehensionScore とは別物として扱う。
   */
  accuracyScore: number | null
  /** Meaning Flash の1件あたり表示時間（ms） */
  exposureMs: number | null
  /** 計測として有効か。false の結果は統計・適応計算から除外する。 */
  valid: boolean
  createdAt: string
}

export interface ReadingTest {
  id: string
  userId: string
  sessionId: string | null
  passageId: string
  isBaseline: boolean
  elapsedSeconds: number
  characterCount: number
  cpm: number
  comprehensionScore: number | null
  recallScore: number | null
  recallText: string | null
  /**
   * 設問タイプ別の正答率（0–100）。
   * Baseline Profile の Main Idea / Cause & Effect / Structure はここから作る。
   */
  typeScores: Partial<Record<QuestionType, number>> | null
  createdAt: string
}

export type RecallTaskStatus = 'pending' | 'completed' | 'expired'

export interface RecallTask {
  id: string
  userId: string
  passageId: string
  sourceSessionId: string | null
  scheduledDate: LocalDate
  expiresOn: LocalDate
  completedAt: string | null
  recallScore: number | null
  recallText: string | null
  status: RecallTaskStatus
  createdAt: string
}
