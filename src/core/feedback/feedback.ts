import { REGRESSION, SKILL } from '../config/training-config'
import { SKILL_LABELS } from '../types/skill'
import type { SkillProfile } from '../types/skill'
import type { TrainingType } from '../types/training'
import type { RegressionVerdict } from '../training/regression'

/**
 * トレーニング後のフィードバック。
 *
 * 目的はスコアの再掲ではなく、「次に何を変えればよいか」を1〜2文で返すこと。
 * 現時点はルールベース。将来 AI Coach に差し替えるため、
 * 生成器はインタフェースとして分離してある（入力と出力の形は変えない）。
 */
export type FeedbackTone = 'positive' | 'caution' | 'neutral'

export interface FeedbackMessage {
  tone: FeedbackTone
  text: string
}

export interface TrainingFeedbackInput {
  trainingType: TrainingType
  cpm: number | null
  targetCpm: number | null
  comprehensionScore: number | null
  /** トレーニング固有の正答率・一致率 */
  accuracyScore: number | null
  immediateRecallScore: number | null
  /** 直近の同種トレーニングの実績 */
  previousCpm: number | null
  previousComprehension: number | null
  /** Variable Speed: 落とすべきだった区間の数 */
  missedSlowSegments?: number
  /** Regression Control の判定 */
  regressionVerdict?: RegressionVerdict
}

export interface SessionFeedbackInput {
  profile: SkillProfile
  cpm: number | null
  comprehension: number | null
  immediateRecall: number | null
  previousCpm: number | null
  previousComprehension: number | null
}

export interface FeedbackGenerator {
  forTraining(input: TrainingFeedbackInput): FeedbackMessage[]
  forSession(input: SessionFeedbackInput): FeedbackMessage[]
}

/** 速度が有意に動いたと見なす変化率 */
const SPEED_CHANGE_RATIO = 0.05
/** 理解度が落ちたと見なす差 */
const COMPREHENSION_DROP = 10

function speedDelta(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous <= 0) return null
  return (current - previous) / previous
}

const percent = (value: number) => `${Math.abs(Math.round(value * 100))}%`

function trainingMessages(input: TrainingFeedbackInput): FeedbackMessage[] {
  const messages: FeedbackMessage[] = []
  const delta = speedDelta(input.cpm, input.previousCpm)
  const comprehensionDelta =
    input.comprehensionScore !== null && input.previousComprehension !== null
      ? input.comprehensionScore - input.previousComprehension
      : null

  // 速度と理解の関係。速度が上がったこと自体は成果として扱わない。
  if (delta !== null && delta >= SPEED_CHANGE_RATIO) {
    if (comprehensionDelta !== null && comprehensionDelta <= -COMPREHENSION_DROP) {
      messages.push({
        tone: 'caution',
        text: `速度は ${percent(delta)} 上がりましたが、理解度が ${Math.abs(comprehensionDelta)} ポイント下がっています。次回は速度を戻して、理解が保てる範囲を確かめます。`,
      })
    } else {
      messages.push({
        tone: 'positive',
        text: `速度が ${percent(delta)} 上がり、理解度も保てています。この速度帯は身についてきています。`,
      })
    }
  } else if (delta !== null && delta <= -SPEED_CHANGE_RATIO && comprehensionDelta !== null && comprehensionDelta > 0) {
    messages.push({
      tone: 'neutral',
      text: '速度は落ちましたが理解度は上がっています。まず理解を安定させる段階です。',
    })
  }

  if (input.trainingType === 'variable_speed' && (input.missedSlowSegments ?? 0) > 0) {
    messages.push({
      tone: 'caution',
      text: `主張や核心を含む区間を ${input.missedSlowSegments} か所、速いまま通過しています。ここで落とせるかどうかが、速度を上げても取りこぼさない鍵になります。`,
    })
  }

  if (input.trainingType === 'meaning_flash' && input.accuracyScore !== null) {
    if (input.accuracyScore >= 80) {
      messages.push({
        tone: 'positive',
        text: '短い露出でも意味を取れています。次はもう少し表示時間を詰めます。',
      })
    } else if (input.accuracyScore < 50) {
      messages.push({
        tone: 'caution',
        text: '文字を追う時間が足りていない可能性があります。表示時間を戻して、全体を一度に見る感覚を作ります。',
      })
    }
  }

  if (input.trainingType === 'prediction_reading' && input.accuracyScore !== null) {
    messages.push(
      input.accuracyScore >= 60
        ? {
            tone: 'positive',
            text: '論理の方向を掴めています。予測を持って読めている状態です。',
          }
        : {
            tone: 'caution',
            text: '予測が外れています。段落の最初の一文が、次に何が来るかの手がかりになります。',
          },
    )
  }

  if (input.trainingType === 'regression_control' && input.regressionVerdict) {
    const verdictMessages: Partial<Record<RegressionVerdict, FeedbackMessage>> = {
      improved: { tone: 'positive', text: '読み戻りが減り、理解度も保てています。' },
      too_fast: {
        tone: 'caution',
        text: '読み戻りは減りましたが理解度が落ちています。戻らなかったのではなく、取りこぼしたまま進んでいる可能性があります。',
      },
      needs_more_control: {
        tone: 'caution',
        text: `読み戻りが 1000 字あたり ${REGRESSION.highBackPerKiloChars} 回を超えています。一度先まで読み切ってから戻ると減ることがあります。`,
      },
    }
    const message = verdictMessages[input.regressionVerdict]
    if (message) messages.push(message)
  }

  if (input.trainingType === 'immediate_recall' && input.immediateRecallScore !== null) {
    messages.push(
      input.immediateRecallScore >= 75
        ? { tone: 'positive', text: '要点を取り出せています。読みながら構造を作れている状態です。' }
        : {
            tone: 'caution',
            text: '思い出せた項目が半分以下です。読む前に見出しを拾い、何の話かを先に決めると残りやすくなります。',
          },
    )
  }

  if (messages.length === 0) {
    messages.push({ tone: 'neutral', text: '記録しました。次のトレーニングに進みます。' })
  }

  return messages
}

function sessionMessages(input: SessionFeedbackInput): FeedbackMessage[] {
  const messages: FeedbackMessage[] = []
  const { profile } = input

  const delta = speedDelta(input.cpm, input.previousCpm)
  const comprehensionDelta =
    input.comprehension !== null && input.previousComprehension !== null
      ? input.comprehension - input.previousComprehension
      : null

  if (delta !== null && comprehensionDelta !== null) {
    if (delta >= SPEED_CHANGE_RATIO && comprehensionDelta >= 0) {
      messages.push({
        tone: 'positive',
        text: `読書速度が ${percent(delta)} 上昇していますが、理解度も維持されています。`,
      })
    } else if (delta >= SPEED_CHANGE_RATIO && comprehensionDelta < 0) {
      messages.push({
        tone: 'caution',
        text: `読書速度は ${percent(delta)} 上昇した一方、理解度が ${Math.abs(comprehensionDelta)} ポイント下がっています。明日は Speed Push を弱め、構造把握の時間を増やします。`,
      })
    }
  }

  // 速い理解と弱い長期記憶の組み合わせ
  if (
    profile.meaning_extraction.state === 'strong' &&
    profile.delayed_recall.state === 'weak'
  ) {
    messages.push({
      tone: 'caution',
      text: '意味把握は速い一方、翌日 Recall が弱い傾向があります。読んだ直後に要点を書き出す時間を増やします。',
    })
  }

  if (profile.reading_speed.state === 'strong' && profile.comprehension.state === 'weak') {
    messages.push({
      tone: 'caution',
      text: '速度は出ていますが理解が追いついていません。速度は上げず、段落ごとの主張を掴む訓練を増やします。',
    })
  }

  const weakest = (Object.values(profile) as SkillProfile[keyof SkillProfile][])
    .filter((m) => m.state === 'weak')
    .sort((a, b) => (a.score ?? 0) - (b.score ?? 0))[0]

  if (weakest && messages.length === 0) {
    messages.push({
      tone: 'neutral',
      text: `いま最も弱いのは ${SKILL_LABELS[weakest.id]} です。明日はこの配分を増やします。`,
    })
  }

  const unmeasured = (Object.values(profile) as SkillProfile[keyof SkillProfile][]).filter(
    (m) => m.state === 'unmeasured',
  )
  if (messages.length === 0 && unmeasured.length > 0) {
    messages.push({
      tone: 'neutral',
      text: `まだ ${unmeasured.length} つの能力を測定できていません。続けるほど構成が自分に合っていきます。`,
    })
  }

  if (messages.length === 0) {
    messages.push({ tone: 'neutral', text: '各項目とも安定しています。この配分を続けます。' })
  }

  return messages
}

/** 現行の実装。AI Coach を導入する際は、この実装だけを差し替える。 */
export const ruleBasedFeedback: FeedbackGenerator = {
  forTraining: trainingMessages,
  forSession: sessionMessages,
}

/** サンプル不足で判断できないかどうか。UI 側で断定的な文言を避けるために使う。 */
export function hasEnoughDataForFeedback(profile: SkillProfile): boolean {
  return Object.values(profile).some((m) => m.sampleCount >= SKILL.minSamples)
}
