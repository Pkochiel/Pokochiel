import type { z } from 'zod'
import type {
  BtrResult,
  ChunkLevel,
  LocalDate,
  Profile,
  ReadingTest,
  RecallTask,
  TrainingResult,
  TrainingSession,
} from '@/core/types'
import { compareLocalDate, isSameOrBefore } from '@/core/util/date'
import { CHUNKING, MEANING_FLASH } from '@/core/config/training-config'
import {
  clearAllCollections,
  type CollectionName,
  type RecordStore,
} from '@/data/persistence/record-store'
import type {
  BtrResultInput,
  BtrResultQuery,
  ProfileInput,
  ReadingTestInput,
  RecallTaskInput,
  ResultQuery,
  SessionInput,
  TrainingRepository,
  TrainingResultInput,
} from './types'
import {
  btrResultSchema,
  profileSchema,
  readingTestSchema,
  recallTaskSchema,
  resultSchema,
  sessionSchema,
} from './schema'

/** アカウント登録を伴わない Local First 構成での固定 ID。 */
export const LOCAL_USER_ID = 'local-user'

/**
 * 記録は必ず時系列で返す。
 *
 * RecordStore は順序を保証しない（IndexedDB は id 順、localStorage は追記順）。
 * 一方で trend 判定・直近 N 件・最新の Baseline は並び順に意味を持たせているため、
 * 保存先の都合が指標に混ざらないようこの層で整列する。
 */
function chronologically<T extends { id: string; createdAt: string }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id),
  )
}

export interface RecordStoreRepositoryDeps {
  store: RecordStore
  /** 現在時刻。テストでは固定値を注入する。 */
  now: () => Date
  createId: () => string
  defaultTimezone?: string
}

/**
 * TrainingRepository の実装。
 *
 * 保存先は RecordStore 越しにしか触らないため、IndexedDB か localStorage かを
 * このクラスは知らない（差し替えても、ここと UI は変わらない）。
 * ドメイン規則（既定値・重複排除・期限切れの扱い）はこの層に閉じる。
 */
export class RecordStoreRepository implements TrainingRepository {
  constructor(private readonly deps: RecordStoreRepositoryDeps) {}

  // ---- 低レベル入出力 -------------------------------------------------

  /**
   * 保存済みデータを読み出す。スキーマに合わない行は捨てる。
   * 過去の不正なデータでアプリが起動しなくなる事態を避けるため、例外は投げない。
   */
  private async readAll<T>(collection: CollectionName, schema: z.ZodType<T>): Promise<T[]> {
    const rows = await this.deps.store.list(collection)
    return rows.flatMap((row) => {
      const result = schema.safeParse(row)
      return result.success ? [result.data] : []
    })
  }

  private async readOne<T>(
    collection: CollectionName,
    id: string,
    schema: z.ZodType<T>,
  ): Promise<T | null> {
    const row = await this.deps.store.get(collection, id)
    if (row === null) return null
    const result = schema.safeParse(row)
    return result.success ? result.data : null
  }

  private nowIso(): string {
    return this.deps.now().toISOString()
  }

  // ---- Profile --------------------------------------------------------

  async getProfile(): Promise<Profile | null> {
    const profiles = (await this.readAll('profile', profileSchema)) as Profile[]
    return profiles[0] ?? null
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
      meaningFlashLevel:
        input.meaningFlashLevel ?? existing?.meaningFlashLevel ?? MEANING_FLASH.defaultLevel,
      baselineProfile: input.baselineProfile ?? existing?.baselineProfile ?? null,
      usedBaselinePassageIds: input.usedBaselinePassageIds ?? existing?.usedBaselinePassageIds ?? [],
      timezone: input.timezone ?? existing?.timezone ?? this.deps.defaultTimezone ?? 'Asia/Tokyo',
      onboardedAt: input.onboardedAt ?? existing?.onboardedAt ?? null,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    await this.deps.store.put('profile', profile)
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
    await this.deps.store.put('sessions', session)
    return session
  }

  async completeSession(id: string, completedAt: string, durationSeconds: number): Promise<void> {
    const session = (await this.readOne('sessions', id, sessionSchema)) as TrainingSession | null
    if (!session) return
    const updated: TrainingSession = { ...session, completedAt, durationSeconds }
    await this.deps.store.put('sessions', updated)
  }

  async listSessions(): Promise<TrainingSession[]> {
    const sessions = (await this.readAll('sessions', sessionSchema)) as TrainingSession[]
    return [...sessions].sort(
      (a, b) => a.startedAt.localeCompare(b.startedAt) || a.id.localeCompare(b.id),
    )
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
      level: input.level ?? null,
      accuracyScore: input.accuracyScore ?? null,
      exposureMs: input.exposureMs ?? null,
      difficulty: input.difficulty ?? null,
      valid: input.valid ?? true,
      createdAt: this.nowIso(),
    }
    await this.deps.store.put('results', result)
    return result
  }

  /**
   * 旧スキーマの行を現行のドメイン型に合わせる。
   * chunkLevel は level に統合されたため、古い記録を落とさずに引き継ぐ。
   */
  private migrateResult(row: TrainingResult & { chunkLevel?: ChunkLevel | null }): TrainingResult {
    const { chunkLevel, ...rest } = row
    return { ...rest, level: rest.level ?? chunkLevel ?? null }
  }

  async listResults(query: ResultQuery = {}): Promise<TrainingResult[]> {
    const validOnly = query.validOnly ?? true
    const sessions = await this.listSessions()
    const dateBySession = new Map(sessions.map((s) => [s.id, s.localDate]))

    return chronologically((await this.readAll('results', resultSchema)) as TrainingResult[])
      .map((row) => this.migrateResult(row))
      .filter((result) => {
        if (validOnly && !result.valid) return false
        if (query.trainingType && result.trainingType !== query.trainingType) return false

        const date = dateBySession.get(result.sessionId)
        if (query.from && (!date || compareLocalDate(date, query.from) < 0)) return false
        if (query.to && (!date || compareLocalDate(date, query.to) > 0)) return false
        return true
      })
  }

  // ---- BTR results ----------------------------------------------------

  /**
   * BTR の種目1回分を保存する。
   *
   * 日付をセッションから引かずに記録そのものが持つ。日替わりで種目を回すのに
   * 「その種目を最後にやった日」が要り、毎回セッションを突き合わせずに済ませたい。
   */
  async saveBtrResult(input: BtrResultInput): Promise<BtrResult> {
    const result: BtrResult = {
      id: this.deps.createId(),
      userId: LOCAL_USER_ID,
      sessionId: input.sessionId,
      exercise: input.exercise,
      variant: input.variant ?? null,
      score: input.score,
      attempts: input.attempts ?? [],
      elapsedMs: input.elapsedMs ?? null,
      timeLimitMs: input.timeLimitMs ?? null,
      accuracy: input.accuracy ?? null,
      level: input.level ?? null,
      judgement: input.judgement ?? null,
      lowerIsBetter: input.lowerIsBetter ?? false,
      cpm: input.cpm ?? null,
      valid: input.valid ?? true,
      localDate: input.localDate,
      createdAt: this.nowIso(),
    }
    await this.deps.store.put('btrResults', result)
    return result
  }

  async listBtrResults(query: BtrResultQuery = {}): Promise<BtrResult[]> {
    const validOnly = query.validOnly ?? true

    return chronologically(
      (await this.readAll('btrResults', btrResultSchema)) as BtrResult[],
    ).filter((result) => {
      if (validOnly && !result.valid) return false
      if (query.exercise && result.exercise !== query.exercise) return false
      if (query.from && compareLocalDate(result.localDate, query.from) < 0) return false
      if (query.to && compareLocalDate(result.localDate, query.to) > 0) return false
      return true
    })
  }

  // ---- Reading tests --------------------------------------------------

  async saveReadingTest(input: ReadingTestInput): Promise<ReadingTest> {
    const test: ReadingTest = {
      id: this.deps.createId(),
      userId: LOCAL_USER_ID,
      ...input,
      typeScores: input.typeScores ?? null,
      createdAt: this.nowIso(),
    }
    await this.deps.store.put('readingTests', test)
    return test
  }

  async listReadingTests(): Promise<ReadingTest[]> {
    return chronologically((await this.readAll('readingTests', readingTestSchema)) as ReadingTest[])
  }

  // ---- Recall tasks ---------------------------------------------------

  async scheduleRecallTasks(inputs: readonly RecallTaskInput[]): Promise<RecallTask[]> {
    const existing = await this.listRecallTasks()
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
    if (created.length > 0) await this.deps.store.putMany('recallTasks', created)
    return created
  }

  async listRecallTasks(): Promise<RecallTask[]> {
    return chronologically((await this.readAll('recallTasks', recallTaskSchema)) as RecallTask[])
  }

  /**
   * 実施可能な Recall タスク。
   * 期限切れは pending のままにせず expired に落として返さない
   * （遅れて実施した結果を長期記憶の指標に混ぜないため）。
   */
  async listDueRecallTasks(today: LocalDate): Promise<RecallTask[]> {
    const tasks = await this.listRecallTasks()
    const expired = tasks.flatMap((task): RecallTask[] =>
      task.status === 'pending' && compareLocalDate(task.expiresOn, today) < 0
        ? [{ ...task, status: 'expired' }]
        : [],
    )
    if (expired.length > 0) await this.deps.store.putMany('recallTasks', expired)

    const expiredIds = new Set(expired.map((task) => task.id))
    return tasks
      .filter(
        (t) =>
          t.status === 'pending' && !expiredIds.has(t.id) && isSameOrBefore(t.scheduledDate, today),
      )
      .sort((a, b) => compareLocalDate(a.scheduledDate, b.scheduledDate))
  }

  async completeRecallTask(
    id: string,
    result: { recallScore: number; recallText: string; completedAt: string },
  ): Promise<void> {
    const task = (await this.readOne('recallTasks', id, recallTaskSchema)) as RecallTask | null
    if (!task) return
    const completed: RecallTask = {
      ...task,
      status: 'completed',
      recallScore: result.recallScore,
      recallText: result.recallText,
      completedAt: result.completedAt,
    }
    await this.deps.store.put('recallTasks', completed)
  }

  // ---- Reset ----------------------------------------------------------

  async reset(): Promise<void> {
    await clearAllCollections(this.deps.store)
  }
}
