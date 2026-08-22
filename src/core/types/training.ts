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

export type SessionType = 'baseline' | 'daily' | 'single' | 'recall' | 'btr'

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

/**
 * BTR の種目1回分の記録。
 *
 * 既存の TrainingResult とは別の型にしている。BTR の受講記録は
 * 「種目ごとの数値の並び」であって、CPM や理解度を軸にしたものではない。
 * 同じ表に押し込むと、どちらの種目でも使われない列が並ぶことになる。
 *
 * 型は docs/BTR_METHOD.md §5 に合わせている。
 */
export interface BtrResult {
  id: string
  userId: string
  sessionId: string
  /** 種目。core/training/btr/exercises.ts の BtrExercise。 */
  exercise: string
  /** その種目の主スコア（到達数・正答数・往復数など） */
  score: number
  /** 複数試行する種目の各試行スコア（数字ランダムの4枚など）。単発なら空。 */
  attempts: number[]
  /** 所要時間（ms）。時間制の種目では制限時間そのものになる。 */
  elapsedMs: number | null
  /** そのとき課された制限時間（ms）。級に相当する。 */
  timeLimitMs: number | null
  /** 見落とし率など、質を表す副指標（0–100） */
  accuracy: number | null
  /** そのときの級（0 始まり）。級を持たない種目は null。 */
  level: number | null
  /**
   * 小さいほうがよい種目か。
   *
   * カウント呼吸法だけ true。推移グラフや「伸びたか」の判定で
   * 向きを間違えないための印であり、記録に残さないと後から復元できない。
   */
  lowerIsBetter: boolean
  /** 分速（字/分）。倍速読書と普通読書だけが持つ。 */
  cpm: number | null
  /** 計測として有効か。false の記録は推移から除く。 */
  valid: boolean
  localDate: LocalDate
  createdAt: string
}
