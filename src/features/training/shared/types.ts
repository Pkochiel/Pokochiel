import type { ChunkLevel, TrainingPassage, TrainingType } from '@/core/types'

/** 各トレーニングが返す計測結果。保存とスコア集計はランナー側の責務。 */
export interface BlockOutcome {
  cpm?: number | null
  targetCpm?: number | null
  comprehensionScore?: number | null
  immediateRecallScore?: number | null
  recallText?: string | null
  chunkLevel?: ChunkLevel | null
  backCount?: number | null
  pauseCount?: number | null
  valid?: boolean
  /** 理解度の判定に使った設問数。速度適応の信頼度に使う。 */
  questionCount?: number
}

export interface TrainingBlockProps {
  passage: TrainingPassage
  targetCpm: number
  chunkLevel: ChunkLevel
  /** 割り当てられた時間（分）。目安の提示に使う。 */
  minutes: number
  onComplete: (outcome: BlockOutcome) => void
}

export const TRAINING_LABELS: Record<TrainingType, string> = {
  warmup: 'ウォームアップ',
  speed_push: 'Speed Push',
  chunk_reading: 'Chunk Reading',
  meaning_flash: 'Meaning Flash',
  structure_reading: 'Structure Reading',
  prediction_reading: 'Prediction Reading',
  variable_speed: 'Variable Speed',
  regression_control: 'Regression Control',
  comprehension: 'Comprehension Test',
  immediate_recall: 'Immediate Recall',
  delayed_recall: '昨日の Recall',
}
