import { RECALL, SCORING } from '../config/training-config'
import type { SkillAxis, SkillRadar } from '../types/plan'
import type { TrainingType } from '../types/training'

export interface WeaknessAssessment {
  /** 弱い順に並べた軸 */
  ranked: SkillAxis[]
  /** 配分を増やすべきトレーニング */
  emphasize: TrainingType[]
  notes: string[]
}

/** 軸と、それを鍛えるトレーニングの対応。 */
const AXIS_TO_TRAINING: Record<SkillAxis, TrainingType | null> = {
  reading_speed: 'speed_push',
  chunking: 'chunk_reading',
  structure: 'structure_reading',
  comprehension: 'comprehension',
  recall: 'immediate_recall',
  // Variable Speed は MVP の日次構成に含めない
  adaptive_reading: null,
}

/** どの軸が実測済みか。省略した場合はすべて実測済みとして扱う。 */
export type MeasuredAxes = Partial<Record<SkillAxis, boolean>>

/**
 * 弱点を判定し、配分を増やすべきトレーニングを返す。
 *
 * 仕様上の重要な方針：
 * - Recall が低いときは速度を極端に下げるのではなく、Recall と Structure の配分を増やす
 * - Chunking が弱いときは Chunk Reading を増やす
 *
 * 実測されていない軸は判定に使わない。未実測は中央値で埋まっているため、
 * そのまま比較すると「まだ測っていない」ことが「弱点」として扱われてしまう。
 * 実測が1つもない新規ユーザーには、基本構成をそのまま使う。
 */
export function assessWeakness(radar: SkillRadar, measured: MeasuredAxes = {}): WeaknessAssessment {
  const isMeasured = (axis: SkillAxis) => measured[axis] ?? true
  const axes = (Object.keys(radar) as SkillAxis[]).filter(isMeasured)

  const ranked = axes.slice().sort((a, b) => radar[a] - radar[b] || a.localeCompare(b))

  const emphasize: TrainingType[] = []
  const notes: string[] = []

  if (isMeasured('recall') && radar.recall < RECALL.lowRecallThreshold) {
    emphasize.push('immediate_recall', 'structure_reading')
    notes.push('想起が弱いため、速度を下げるのではなく Recall と構造把握の配分を増やします')
  }
  if (isMeasured('chunking') && radar.chunking < SCORING.neutralScore) {
    emphasize.push('chunk_reading')
    notes.push('チャンク認識が弱いため、Chunk Reading の配分を増やします')
  }
  if (isMeasured('comprehension') && radar.comprehension < SCORING.comprehensionPassThreshold) {
    emphasize.push('structure_reading', 'comprehension')
    notes.push('理解度が目標を下回っているため、構造把握と理解度テストを増やします')
  }

  // 明示的な条件に当てはまらない場合は、最も弱い軸に対応するトレーニングを増やす
  if (emphasize.length === 0 && ranked.length > 0) {
    const weakest = ranked[0]
    const training = weakest ? AXIS_TO_TRAINING[weakest] : null
    if (training) {
      emphasize.push(training)
      notes.push('現在の弱点に合わせて配分を微調整しています')
    }
  }

  if (ranked.length === 0) {
    notes.push('実績がまだないため、標準の構成で始めます')
  }

  return { ranked, emphasize: [...new Set(emphasize)], notes }
}
