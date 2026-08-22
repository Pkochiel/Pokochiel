import type {
  BaselineProfile,
  BtrResult,
  ChunkLevel,
  DailyTrainingPlan,
  Difficulty,
  LocalDate,
  PlanDuration,
  Profile,
  ReadingTest,
  RecallTask,
  QuestionType,
  SessionType,
  TrainingResult,
  TrainingSession,
  TrainingType,
} from '@/core/types'

export interface ProfileInput {
  displayName?: string | null
  baselineCpm?: number | null
  targetCpm?: number | null
  preferredDurationMinutes?: PlanDuration
  chunkLevel?: ChunkLevel
  meaningFlashLevel?: ChunkLevel
  timezone?: string
  onboardedAt?: string | null
  baselineProfile?: BaselineProfile | null
  usedBaselinePassageIds?: string[]
}

export interface SessionInput {
  sessionType: SessionType
  startedAt: string
  localDate: LocalDate
}

export interface TrainingResultInput {
  sessionId: string
  trainingType: TrainingType
  passageId: string | null
  cpm?: number | null
  comprehensionScore?: number | null
  immediateRecallScore?: number | null
  delayedRecallScore?: number | null
  targetCpm?: number | null
  backCount?: number | null
  pauseCount?: number | null
  level?: ChunkLevel | null
  accuracyScore?: number | null
  exposureMs?: number | null
  difficulty?: Difficulty | null
  valid?: boolean
}

export interface BtrResultInput {
  sessionId: string
  exercise: string
  score: number
  localDate: LocalDate
  /** サッケイドのたて／よこのような、同じ種目の中の区別。 */
  variant?: string | null
  attempts?: number[]
  elapsedMs?: number | null
  timeLimitMs?: number | null
  accuracy?: number | null
  level?: number | null
  /** カウント呼吸法のように小さいほうがよい種目だけ true。 */
  lowerIsBetter?: boolean
  cpm?: number | null
  valid?: boolean
}

export interface BtrResultQuery {
  from?: LocalDate
  to?: LocalDate
  exercise?: string
  /** true のとき valid=false の記録を除外する（既定: true） */
  validOnly?: boolean
}

export interface ReadingTestInput {
  sessionId: string | null
  passageId: string
  isBaseline: boolean
  elapsedSeconds: number
  characterCount: number
  cpm: number
  comprehensionScore: number | null
  recallScore: number | null
  recallText: string | null
  typeScores?: Partial<Record<QuestionType, number>> | null
}

export interface RecallTaskInput {
  passageId: string
  sourceSessionId: string | null
  scheduledDate: LocalDate
  expiresOn: LocalDate
}

export interface ResultQuery {
  from?: LocalDate
  to?: LocalDate
  trainingType?: TrainingType
  /** true のとき valid=false の結果を除外する（既定: true） */
  validOnly?: boolean
}

/**
 * 永続化の境界。
 *
 * UI はこのインタフェースだけに依存する。保存先（Phase 1: localStorage →
 * Phase 2: IndexedDB、将来: Supabase Sync）が変わっても、このシグネチャは変えない。
 * すべて Promise を返すのは、同期前提の実装に UI が引きずられないようにするため。
 */
export interface TrainingRepository {
  getProfile(): Promise<Profile | null>
  saveProfile(input: ProfileInput): Promise<Profile>

  createSession(input: SessionInput): Promise<TrainingSession>
  completeSession(id: string, completedAt: string, durationSeconds: number): Promise<void>
  listSessions(): Promise<TrainingSession[]>

  saveResult(input: TrainingResultInput): Promise<TrainingResult>
  listResults(query?: ResultQuery): Promise<TrainingResult[]>

  saveBtrResult(input: BtrResultInput): Promise<BtrResult>
  listBtrResults(query?: BtrResultQuery): Promise<BtrResult[]>

  saveReadingTest(input: ReadingTestInput): Promise<ReadingTest>
  listReadingTests(): Promise<ReadingTest[]>

  scheduleRecallTasks(inputs: readonly RecallTaskInput[]): Promise<RecallTask[]>
  listRecallTasks(): Promise<RecallTask[]>
  listDueRecallTasks(today: LocalDate): Promise<RecallTask[]>
  completeRecallTask(
    id: string,
    result: { recallScore: number; recallText: string; completedAt: string },
  ): Promise<void>

  getPlan(date: LocalDate): Promise<DailyTrainingPlan | null>
  savePlan(plan: DailyTrainingPlan): Promise<DailyTrainingPlan>

  /** 開発・テスト用。保存済みデータを消す。 */
  reset(): Promise<void>
}
