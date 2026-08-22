import { z } from 'zod'

const planDuration = z.union([z.literal(10), z.literal(20), z.literal(30)])
const chunkLevel = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
])
const difficulty = chunkLevel
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const score = z.number().min(0).max(100).nullable()

const baselineProfileSchema = z.object({
  cpm: z.number().nullable(),
  comprehension: score,
  mainIdea: score,
  causeEffect: score,
  structure: score,
  immediateRecall: score,
  attempts: z.number().int().nonnegative(),
  updatedAt: z.string().nullable(),
})

export const profileSchema = z.object({
  id: z.string(),
  displayName: z.string().nullable(),
  baselineCpm: z.number().positive().nullable(),
  targetCpm: z.number().positive().nullable(),
  /** 旧データには存在しないため既定値を与える（migration compatibility） */
  baselineProfile: baselineProfileSchema.nullable().default(null),
  usedBaselinePassageIds: z.array(z.string()).default([]),
  preferredDurationMinutes: planDuration,
  chunkLevel,
  meaningFlashLevel: chunkLevel.default(2),
  timezone: z.string(),
  onboardedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const sessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  startedAt: z.string(),
  completedAt: z.string().nullable(),
  durationSeconds: z.number().nonnegative().nullable(),
  sessionType: z.enum(['baseline', 'daily', 'single', 'recall', 'btr']),
  localDate,
})

export const resultSchema = z.object({
  id: z.string(),
  userId: z.string(),
  sessionId: z.string(),
  trainingType: z.enum([
    'warmup',
    'speed_push',
    'chunk_reading',
    'meaning_flash',
    'structure_reading',
    'prediction_reading',
    'variable_speed',
    'regression_control',
    'comprehension',
    'immediate_recall',
    'delayed_recall',
  ]),
  passageId: z.string().nullable(),
  cpm: z.number().nonnegative().nullable(),
  comprehensionScore: score,
  immediateRecallScore: score,
  delayedRecallScore: score,
  targetCpm: z.number().nonnegative().nullable(),
  backCount: z.number().nonnegative().nullable(),
  pauseCount: z.number().nonnegative().nullable(),
  /** 現行のフィールド。旧データは chunkLevel から移送する */
  level: chunkLevel.nullable().default(null),
  /** 旧フィールド。読み出し時に level へ移送するためだけに受け付ける */
  chunkLevel: chunkLevel.nullable().optional(),
  accuracyScore: score.default(null),
  exposureMs: z.number().nonnegative().nullable().default(null),
  difficulty: difficulty.nullable(),
  valid: z.boolean(),
  createdAt: z.string(),
})

export const readingTestSchema = z.object({
  id: z.string(),
  userId: z.string(),
  sessionId: z.string().nullable(),
  passageId: z.string(),
  isBaseline: z.boolean(),
  elapsedSeconds: z.number().positive(),
  characterCount: z.number().positive(),
  cpm: z.number().nonnegative(),
  comprehensionScore: score,
  recallScore: score,
  recallText: z.string().nullable(),
  typeScores: z.record(z.string(), z.number()).nullable().default(null),
  createdAt: z.string(),
})

export const recallTaskSchema = z.object({
  id: z.string(),
  userId: z.string(),
  passageId: z.string(),
  sourceSessionId: z.string().nullable(),
  scheduledDate: localDate,
  expiresOn: localDate,
  completedAt: z.string().nullable(),
  recallScore: score,
  recallText: z.string().nullable(),
  status: z.enum(['pending', 'completed', 'expired']),
  createdAt: z.string(),
})

export const planSchema = z.object({
  id: z.string(),
  userId: z.string(),
  planDate: localDate,
  totalMinutes: planDuration,
  blocks: z.array(
    z.object({
      order: z.number().int(),
      type: z.string(),
      minutes: z.number().nonnegative(),
      passageId: z.string().optional(),
      targetCpm: z.number().optional(),
      chunkLevel: chunkLevel.optional(),
      reason: z.string().optional(),
    }),
  ),
  targetCpm: z.number().nullable(),
  chunkLevel: chunkLevel.nullable(),
  generatedReason: z
    .object({ weakestSkills: z.array(z.string()), notes: z.array(z.string()) })
    .nullable(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
})

/**
 * BTR の種目記録。
 *
 * 既存の resultSchema とは別に持つ。BTR の受講記録は「種目ごとの数値の並び」で、
 * CPM や理解度を軸にしたものではない。同じ表に押し込むと、
 * どちらの種目でも使われない列が並ぶ。
 */
export const btrResultSchema = z.object({
  id: z.string(),
  userId: z.string(),
  sessionId: z.string(),
  exercise: z.string(),
  score: z.number(),
  attempts: z.array(z.number()).default([]),
  elapsedMs: z.number().nonnegative().nullable().default(null),
  timeLimitMs: z.number().nonnegative().nullable().default(null),
  accuracy: score,
  level: z.number().int().nonnegative().nullable().default(null),
  lowerIsBetter: z.boolean().default(false),
  cpm: z.number().nonnegative().nullable().default(null),
  valid: z.boolean().default(true),
  localDate,
  createdAt: z.string(),
})
