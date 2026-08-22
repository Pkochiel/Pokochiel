import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BTR_CATALOG, findBtrEntry } from '@/features/training/btr/btr-catalog'
import { BtrSingleTraining } from '@/features/training/btr/btr-single-training'

/** すべての種目を静的に出力する（オフラインでも開けるようにするため）。 */
export function generateStaticParams(): { slug: string }[] {
  return BTR_CATALOG.map((entry) => ({ slug: entry.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  return { title: findBtrEntry(slug)?.name ?? 'BTR トレーニング' }
}

export default async function BtrTrainingPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  if (!findBtrEntry(slug)) notFound()
  return <BtrSingleTraining slug={slug} />
}
