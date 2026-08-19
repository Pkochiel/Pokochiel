import type { Difficulty } from './common'

export type PassageCategory =
  | 'business'
  | 'technology'
  | 'economics'
  | 'psychology'
  | 'science'
  | 'history'
  | 'general'

export type QuestionType = 'main_idea' | 'detail' | 'cause_effect' | 'inference' | 'structure'

/** 教材の出所。将来のユーザー取り込み・AI 生成に備えた拡張点。 */
export type PassageSource = 'seed' | 'imported' | 'generated'

/** Variable Speed Reading で区間に与える重要度ラベル。 */
export type SegmentImportance = 'known' | 'example' | 'evidence' | 'claim' | 'key'

/** 推奨速度帯。ユーザーの速度選択と突き合わせて Adaptive Reading 軸を採点する。 */
export type SpeedBand = 'fast' | 'normal' | 'slow'

export interface DifficultyFactors {
  /** 語彙の平易さ */
  vocabulary: Difficulty
  /** 一文の長さ */
  sentenceLength: Difficulty
  /** 抽象度 */
  abstraction: Difficulty
  /** 情報密度 */
  informationDensity: Difficulty
  /** 論理構造の複雑さ */
  logicalStructure: Difficulty
  /** 専門性 */
  domainSpecificity: Difficulty
}

export interface SummaryChoice {
  id: string
  text: string
  correct: boolean
}

export interface PredictionStop {
  prompt: string
  expectedPoints: string[]
}

export interface PassageParagraph {
  index: number
  text: string
  /** 「結局この段落は何を言っている？」の選択肢 */
  summaryChoices: SummaryChoice[]
  /** Prediction Reading の停止位置として使える場合のみ */
  predictionStop?: PredictionStop
}

export interface SpeedSegment {
  text: string
  importance: SegmentImportance
  recommendedBand: SpeedBand
}

export interface QuestionChoice {
  id: string
  text: string
}

export interface TrainingQuestion {
  id: string
  passageId: string
  type: QuestionType
  prompt: string
  choices: QuestionChoice[]
  correctChoiceId: string
  explanation: string
}

export interface TrainingPassage {
  id: string
  title: string
  category: PassageCategory
  difficulty: Difficulty
  source: PassageSource
  /** 本文（段落を改行で連結したもの） */
  content: string
  /** 空白・改行を除いた実文字数 */
  characterCount: number
  estimatedDifficulty: DifficultyFactors
  /** Recall の模範ポイント（3〜5件） */
  keyPoints: string[]
  paragraphs: PassageParagraph[]
  /** 意味単位の原子。Chunk Reading の分割はこれを最小単位とする。 */
  chunks: string[]
  /** Variable Speed Reading 用の区間。任意。 */
  speedSegments?: SpeedSegment[]
  questions: TrainingQuestion[]
}
