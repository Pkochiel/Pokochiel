import type {
  ChunkLevel,
  DailyTrainingPlan,
  Difficulty,
  LocalDate,
  PlanDuration,
  Profile,
  ReadingTest,
  RecallTask,
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
  timezone?: string
  onboardedAt?: string | null
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
  chunkLevel?: ChunkLevel | null
  difficulty?: Difficulty | null
  valid?: boolean
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
 * Phase 1 は LocalStorageRepository、Phase 2 で SupabaseRepository に差し替える。
 * UI はこのインタフェースだけに依存するため、差し替えで画面側の変更は発生しない。
 */
export interface TrainingRepository {
  getProfile(): Promise<Profile | null>
  saveProfile(input: ProfileInput): Promise<Profile>

  createSession(input: SessionInput): Promise<TrainingSession>
  completeSession(id: string, completedAt: string, durationSeconds: number): Promise<void>
  listSessions(): Promise<TrainingSession[]>

  saveResult(input: TrainingResultInput): Promise<TrainingResult>
  listResults(query?: ResultQuery): Promise<TrainingResult[]>

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
