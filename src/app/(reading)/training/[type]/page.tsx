import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import type { TrainingType } from '@/core/types'
import { SingleTraining } from '@/features/training/single-training'
import { TRAINING_LABELS } from '@/features/training/shared/types'

const TRAINING_TYPES = Object.keys(TRAINING_LABELS) as TrainingType[]

function isTrainingType(value: string): value is TrainingType {
  return (TRAINING_TYPES as readonly string[]).includes(value)
}

/** すべてのトレーニングを静的に出力する（オフラインでも開けるようにするため）。 */
export function generateStaticParams(): { type: string }[] {
  return TRAINING_TYPES.map((type) => ({ type }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ type: string }>
}): Promise<Metadata> {
  const { type } = await params
  return { title: isTrainingType(type) ? TRAINING_LABELS[type] : 'Training' }
}

export default async function TrainingTypePage({
  params,
}: {
  params: Promise<{ type: string }>
}) {
  const { type } = await params
  if (!isTrainingType(type)) notFound()
  return <SingleTraining type={type} />
}
