import { seededShuffle } from '@/core/util/seeded-shuffle'
import { toDifficultyLevel } from '@/core/metrics/difficulty'
import type {
  Difficulty,
  DifficultyFactors,
  PassageCategory,
  PassageParagraph,
  PredictionStop,
  QuestionType,
  SpeedSegment,
  SummaryChoice,
  TrainingPassage,
  TrainingQuestion,
} from '@/core/types'

/**
 * 教材の著者向け入力形式。
 *
 * 本文は「意味単位（チャンク）の配列」として書く。連結すると段落本文になるため、
 * 本文とチャンクを二重に持つ必要がなく、境界が本文と食い違うことも起きない。
 * Chunk Reading はこのチャンクを最小の原子として扱う。
 */
export interface ParagraphDraft {
  chunks: string[]
  /** 「結局この段落は何を言っている？」の正解 */
  summary: string
  /** 同上の誤答 */
  summaryDistractors: [string, string, string]
  /** Prediction Reading の停止位置として使う場合のみ */
  predictionStop?: PredictionStop
}

export interface QuestionDraft {
  type: QuestionType
  prompt: string
  /** 正解。表示時に決定的にシャッフルされるため、常にここに書いてよい。 */
  answer: string
  distractors: [string, string, string]
  explanation: string
}

export interface PassageDraft {
  id: string
  title: string
  category: PassageCategory
  difficulty: Difficulty
  factors: DifficultyFactors
  keyPoints: string[]
  paragraphs: ParagraphDraft[]
  questions: QuestionDraft[]
  speedSegments?: SpeedSegment[]
}

/** 空白・改行を除いた文字数。CPM の分子になる。 */
export function countCharacters(text: string): number {
  return text.replace(/\s/g, '').length
}

function buildSummaryChoices(draft: ParagraphDraft, seed: string): SummaryChoice[] {
  const choices: SummaryChoice[] = [
    { id: `${seed}-c0`, text: draft.summary, correct: true },
    ...draft.summaryDistractors.map((text, i) => ({
      id: `${seed}-c${i + 1}`,
      text,
      correct: false,
    })),
  ]
  return seededShuffle(choices, seed)
}

function buildQuestion(
  draft: QuestionDraft,
  passageId: string,
  index: number,
): TrainingQuestion {
  const seed = `${passageId}-q${index + 1}`
  const correctChoiceId = `${seed}-c0`
  const choices = seededShuffle(
    [
      { id: correctChoiceId, text: draft.answer },
      ...draft.distractors.map((text, i) => ({ id: `${seed}-c${i + 1}`, text })),
    ],
    seed,
  )
  return {
    id: seed,
    passageId,
    type: draft.type,
    prompt: draft.prompt,
    choices,
    correctChoiceId,
    explanation: draft.explanation,
  }
}

/**
 * 著者入力から TrainingPassage を組み立てる。
 * content / characterCount / chunks はすべてチャンクから導出するので、手入力の不整合が起きない。
 */
export function definePassage(draft: PassageDraft): TrainingPassage {
  const paragraphs: PassageParagraph[] = draft.paragraphs.map((paragraph, index) => {
    const seed = `${draft.id}-p${index + 1}`
    const base: PassageParagraph = {
      index,
      text: paragraph.chunks.join(''),
      summaryChoices: buildSummaryChoices(paragraph, seed),
    }
    return paragraph.predictionStop ? { ...base, predictionStop: paragraph.predictionStop } : base
  })

  const content = paragraphs.map((p) => p.text).join('\n')

  return {
    id: draft.id,
    title: draft.title,
    category: draft.category,
    difficulty: draft.difficulty,
    source: 'seed',
    content,
    characterCount: countCharacters(content),
    estimatedDifficulty: draft.factors,
    keyPoints: draft.keyPoints,
    paragraphs,
    chunks: draft.paragraphs.flatMap((p) => p.chunks),
    ...(draft.speedSegments ? { speedSegments: draft.speedSegments } : {}),
    questions: draft.questions.map((q, i) => buildQuestion(q, draft.id, i)),
  }
}

/** 著者が付けた difficulty と、要因から算出した難易度の差。データ検証で使う。 */
export function difficultyDeviation(passage: TrainingPassage): number {
  return Math.abs(passage.difficulty - toDifficultyLevel(passage.estimatedDifficulty))
}
