import type { z } from 'zod'
import type {
  DailyTrainingPlan,
  LocalDate,
  Profile,
  ReadingTest,
  RecallTask,
  TrainingResult,
  TrainingSession,
} from '@/core/types'
import { compareLocalDate, isSameOrBefore } from '@/core/util/date'
import { CHUNKING } from '@/core/config/training-config'
import type {
  ProfileInput,
  ReadingTestInput,
  RecallTaskInput,
  ResultQuery,
  SessionInput,
  TrainingRepository,
  TrainingResultInput,
} from './types'
import {
  planSchema,
  profileSchema,
  readingTestSchema,
  recallTaskSchema,
  resultSchema,
  sessionSchema,
} from './schema'
import type { KeyValueStorage } from './storage'

const SCHEMA_VERSION = 1
const PREFIX = `srl:v${SCHEMA_VERSION}`

const KEYS = {
  profile: `${PREFIX}:profile`,
  sessions: `${PREFIX}:sessions`,
  results: `${PREFIX}:results`,
  readingTests: `${PREFIX}:reading_tests`,
  recallTasks: `${PREFIX}:recall_tasks`,
  plans: `${PREFIX}:plans`,
} as const

/** Phase 1 は単一ユーザー。Phase 2 で auth.uid() に置き換わる。 */
export const LOCAL_USER_ID = 'local-user'

export interface LocalStorageRepositoryDeps {
  storage: KeyValueStorage
  /** 現在時刻。テストでは固定値を注入する。 */
  now: () => Date
  createId: () => string
  defaultTimezone?: string
}

export class LocalStorageRepository implements TrainingRepository {
  constructor(private readonly deps: LocalStorageRepositoryDeps) {}

  // ---- 低レベル入出力 -------------------------------------------------

  /**
   * 保存済みデータを読み出す。壊れていれば捨てて初期値に戻す。
   * 過去の不正なデータでアプリが起動しなくなる事態を避けるため、例外は投げない。
   */
  private readList<T>(key: string, schema: z.ZodType<T>): T[] {
    const raw = this.deps.storage.getItem(key)
    if (!raw) return []
    try {
      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) return []
      return parsed.flatMap((item) => {
        const result = schema.safeParse(item)
        return result.success ? [result.data] : []
      })
    } catch {
      return []
    }
  }

  private writeList<T>(key: string, items: readonly T[]): void {
    this.deps.storage.setItem(key, JSON.stringify(items))
  }

  private nowIso(): string {
    return this.deps.now().toISOString()
  }

  // ---- Profile --------------------------------------------------------

  async getProfile(): Promise<Profile | null> {
    const raw = this.deps.storage.getItem(KEYS.profile)
    if (!raw) return null
    try {
      const result = profileSchema.safeParse(JSON.parse(raw))
      return result.success ? result.data : null
    } catch {
      return null
    }
  }

  async saveProfile(input: ProfileInput): Promise<Profile> {
    const existing = await this.getProfile()
    const now = this.nowIso()
    const profile: Profile = {
      id: existing?.id ?? LOCAL_USER_ID,
      displayName: input.displayName ?? existing?.displayName ?? null,
      baselineCpm: input.baselineCpm ?? existing?.baselineCpm ?? null,
      targetCpm: input.targetCpm ?? existing?.targetCpm ?? null,
      preferredDurationMinutes:
        input.preferredDurationMinutes ?? existing?.preferredDurationMinutes ?? 30,
      chunkLevel: input.chunkLevel ?? existing?.chunkLevel ?? CHUNKING.defaultLevel,
      timezone: input.timezone ?? existing?.timezone ?? this.deps.defaultTimezone ?? 'Asia/Tokyo',
      onboardedAt: input.onboardedAt ?? existing?.onboardedAt ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    this.deps.storage.setItem(KEYS.profile, JSON.stringify(profile))
    return profile
  }

  // ---- Sessions -------------------------------------------------------

  async createSession(input: SessionInput): Promise<TrainingSession> {
    const session: TrainingSession = {
      id: this.deps.createId(),
      userId: LOCAL_USER_ID,
      startedAt: input.startedAt,
      completedAt: null,
      durationSeconds: null,
      sessionType: input.sessionType,
      localDate: input.localDate,
    }
    const sessions = this.readList(KEYS.sessions, sessionSchema) as TrainingSession[]
    this.writeList(KEYS.sessions, [...sessions, session])
    return session
  }

  async completeSession(id: string, completedAt: string, durationSeconds: number): Promise<void> {
    const sessions = this.readList(KEYS.sessions, sessionSchema) as TrainingSession[]
    this.writeList(
      KEYS.sessions,
      sessions.map((s) => (s.id === id ? { ...s, completedAt, durationSeconds } : s)),
    )
  }

  async listSessions(): Promise<TrainingSession[]> {
    return this.readList(KEYS.sessions, sessionSchema) as TrainingSession[]
  }

  // ---- Results --------------------------------------------------------

  async saveResult(input: TrainingResultInput): Promise<TrainingResult> {
    const result: TrainingResult = {
      id: this.deps.createId(),
      userId: LOCAL_USER_ID,
      sessionId: input.sessionId,
      trainingType: input.trainingType,
      passageId: input.passageId,
      cpm: input.cpm ?? null,
      comprehensionScore: input.comprehensionScore ?? null,
      immediateRecallScore: input.immediateRecallScore ?? null,
      delayedRecallScore: input.delayedRecallScore ?? null,
      targetCpm: input.targetCpm ?? null,
      backCount: input.backCount ?? null,
      pauseCount: input.pauseCount ?? null,
      chunkLevel: input.chunkLevel ?? null,
      difficulty: input.difficulty ?? null,
      valid: input.valid ?? true,
      createdAt: this.nowIso(),
    }
    const results = this.readList(KEYS.results, resultSchema) as TrainingResult[]
    this.writeList(KEYS.results, [...results, result])
    return result
  }

  async listResults(query: ResultQuery = {}): Promise<TrainingResult[]> {
    const validOnly = query.validOnly ?? true
    const sessions = await this.listSessions()
    const dateBySession = new Map(sessions.map((s) => [s.id, s.localDate]))

    return (this.readList(KEYS.results, resultSchema) as TrainingResult[]).filter((result) => {
      if (validOnly && !result.valid) return false
      if (query.trainingType && result.trainingType !== query.trainingType) return false

      const date = dateBySession.get(result.sessionId)
      if (query.from && (!date || compareLocalDate(date, query.from) < 0)) return false
      if (query.to && (!date || compareLocalDate(date, query.to) > 0)) return false
      return true
    })
  }

  // ---- Reading tests --------------------------------------------------

  async saveReadingTest(input: ReadingTestInput): Promise<ReadingTest> {
    const test: ReadingTest = {
      id: this.deps.createId(),
      userId: LOCAL_USER_ID,
      ...input,
      createdAt: this.nowIso(),
    }
    const tests = this.readList(KEYS.readingTests, readingTestSchema) as ReadingTest[]
    this.writeList(KEYS.readingTests, [...tests, test])
    return test
  }

  async listReadingTests(): Promise<ReadingTest[]> {
    return this.readList(KEYS.readingTests, readingTestSchema) as ReadingTest[]
  }

  // ---- Recall tasks ---------------------------------------------------

  async scheduleRecallTasks(inputs: readonly RecallTaskInput[]): Promise<RecallTask[]> {
    const existing = this.readList(KEYS.recallTasks, recallTaskSchema) as RecallTask[]
    const key = (t: { passageId: string; scheduledDate: LocalDate }) =>
      `${t.passageId}@${t.scheduledDate}`
    const seen = new Set(existing.map(key))

    const created: RecallTask[] = []
    for (const input of inputs) {
      // (user, passage, scheduledDate) は一意。重複生成しない。
      if (seen.has(key(input))) continue
      seen.add(key(input))
      created.push({
        id: this.deps.createId(),
        userId: LOCAL_USER_ID,
        passageId: input.passageId,
        sourceSessionId: input.sourceSessionId,
        scheduledDate: input.scheduledDate,
        expiresOn: input.expiresOn,
        completedAt: null,
        recallScore: null,
        recallText: null,
        status: 'pending',
        createdAt: this.nowIso(),
      })
    }
    if (created.length > 0) this.writeList(KEYS.recallTasks, [...existing, ...created])
    return created
  }

  async listRecallTasks(): Promise<RecallTask[]> {
    return this.readList(KEYS.recallTasks, recallTaskSchema) as RecallTask[]
  }

  /**
   * 実施可能な Recall タスク。
   * 期限切れは pending のままにせず expired に落として返さない
   * （遅れて実施した結果を長期記憶の指標に混ぜないため）。
   */
  async listDueRecallTasks(today: LocalDate): Promise<RecallTask[]> {
    const tasks = await this.listRecallTasks()
    let mutated = false

    const updated = tasks.map((task) => {
      if (task.status !== 'pending') return task
      if (compareLocalDate(task.expiresOn, today) < 0) {
        mutated = true
        return { ...task, status: 'expired' as const }
      }
      return task
    })
    if (mutated) this.writeList(KEYS.recallTasks, updated)

    return updated
      .filter((t) => t.status === 'pending' && isSameOrBefore(t.scheduledDate, today))
      .sort((a, b) => compareLocalDate(a.scheduledDate, b.scheduledDate))
  }

  async completeRecallTask(
    id: string,
    result: { recallScore: number; recallText: string; completedAt: string },
  ): Promise<void> {
    const tasks = await this.listRecallTasks()
    this.writeList(
      KEYS.recallTasks,
      tasks.map((task) =>
        task.id === id
          ? {
              ...task,
              status: 'completed' as const,
              recallScore: result.recallScore,
              recallText: result.recallText,
              completedAt: result.completedAt,
            }
          : task,
      ),
    )
  }

  // ---- Plans ----------------------------------------------------------

  async getPlan(date: LocalDate): Promise<DailyTrainingPlan | null> {
    const plans = this.readList(KEYS.plans, planSchema) as unknown as DailyTrainingPlan[]
    return plans.find((p) => p.planDate === date) ?? null
  }

  async savePlan(plan: DailyTrainingPlan): Promise<DailyTrainingPlan> {
    const plans = this.readList(KEYS.plans, planSchema) as unknown as DailyTrainingPlan[]
    const others = plans.filter((p) => p.planDate !== plan.planDate)
    this.writeList(KEYS.plans, [...others, plan])
    return plan
  }

  // ---- Reset ----------------------------------------------------------

  async reset(): Promise<void> {
    for (const key of Object.values(KEYS)) this.deps.storage.removeItem(key)
  }
}
