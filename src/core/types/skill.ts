/**
 * 鍛える認知能力の一覧。
 *
 * レーダー表示のためではなく、Daily Training の構成を決めるための
 * ドメインモデルとして持つ。各スキルは「何で測るか」が1対1で決まっている。
 */
export type SkillId =
  | 'reading_speed'
  | 'chunk_recognition'
  | 'meaning_extraction'
  | 'structure_recognition'
  | 'prediction'
  | 'adaptive_reading'
  | 'comprehension'
  | 'immediate_recall'
  | 'delayed_recall'

/**
 * スキルの状態。
 * 未測定を 0 点（＝最弱）として扱わないため、weak とは明確に分ける。
 */
export type SkillState = 'unmeasured' | 'weak' | 'normal' | 'strong'

export interface SkillMeasurement {
  id: SkillId
  /** 0–100。未測定なら null（0 で埋めない） */
  score: number | null
  state: SkillState
  /** 判定に使った有効サンプル数 */
  sampleCount: number
  /** 直近の変化量（後半平均 − 前半平均）。判定できなければ null */
  trend: number | null
}

export type SkillProfile = Record<SkillId, SkillMeasurement>

export const SKILL_IDS: readonly SkillId[] = [
  'reading_speed',
  'chunk_recognition',
  'meaning_extraction',
  'structure_recognition',
  'prediction',
  'adaptive_reading',
  'comprehension',
  'immediate_recall',
  'delayed_recall',
]

export const SKILL_LABELS: Record<SkillId, string> = {
  reading_speed: 'Reading Speed',
  chunk_recognition: 'Chunk Recognition',
  meaning_extraction: 'Meaning Extraction',
  structure_recognition: 'Structure Recognition',
  prediction: 'Prediction',
  adaptive_reading: 'Adaptive Reading',
  comprehension: 'Comprehension',
  immediate_recall: 'Immediate Recall',
  delayed_recall: 'Delayed Recall',
}

/** 各スキルが「何の認知処理を鍛えるのか」。UI の説明文にそのまま使う。 */
export const SKILL_DESCRIPTIONS: Record<SkillId, string> = {
  reading_speed: '文字を追う速度そのもの。理解を伴わない速度は評価しない。',
  chunk_recognition: '文字単位ではなく意味のまとまりで認識する力。',
  meaning_extraction: '短時間の露出から意味を取り出す速度。文字列の記憶ではない。',
  structure_recognition: '段落が担っている役割を掴む力。速読の中核。',
  prediction: '次に何が来るかを仮説として持ちながら読む力。',
  adaptive_reading: '情報の重要度に応じて読む速度を切り替える力。',
  comprehension: '読んだ内容を設問に答えられる形で理解しているか。',
  immediate_recall: '直後に手がかりなしで内容を取り出せるか。',
  delayed_recall: '翌日に取り出せるか。長期記憶の指標。',
}
