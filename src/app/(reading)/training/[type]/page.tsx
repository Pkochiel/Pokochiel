import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { blockLabel } from '@/features/dashboard/today-card'
import type { TrainingType } from '@/core/types'

const TRAINING_TYPES: readonly TrainingType[] = [
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
]

function isTrainingType(value: string): value is TrainingType {
  return (TRAINING_TYPES as readonly string[]).includes(value)
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ type: string }>
}): Promise<Metadata> {
  const { type } = await params
  return { title: isTrainingType(type) ? blockLabel(type) : 'Training' }
}

export default async function TrainingTypePage({
  params,
}: {
  params: Promise<{ type: string }>
}) {
  const { type } = await params
  if (!isTrainingType(type)) notFound()

  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-6 py-16">
      <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">Training</p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">{blockLabel(type)}</h1>
      <p className="mt-4 text-sm leading-relaxed text-fg-muted">
        このトレーニングはまだ利用できません。Baseline Test を先に完了してください。
      </p>
      <Link href="/training" className="mt-8 text-sm text-brand hover:underline">
        ← Today&apos;s Training に戻る
      </Link>
    </main>
  )
}
