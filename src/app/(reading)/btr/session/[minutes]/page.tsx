import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  BTR_SESSION_MINUTES,
  type BtrSessionMinutes,
} from '@/core/planner/btr-session'
import { BtrSessionRunner } from '@/features/training/btr/btr-session-runner'

/** 用意している長さをすべて静的に出す（オフラインでも開けるようにするため）。 */
export function generateStaticParams(): { minutes: string }[] {
  return BTR_SESSION_MINUTES.map((minutes) => ({ minutes: String(minutes) }))
}

function parseMinutes(value: string): BtrSessionMinutes | null {
  const minutes = Number(value)
  return BTR_SESSION_MINUTES.find((allowed) => allowed === minutes) ?? null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ minutes: string }>
}): Promise<Metadata> {
  const { minutes } = await params
  const parsed = parseMinutes(minutes)
  return { title: parsed === null ? 'BTR トレーニング' : `今日の ${parsed} 分` }
}

export default async function BtrSessionPage({
  params,
}: {
  params: Promise<{ minutes: string }>
}) {
  const { minutes } = await params
  const parsed = parseMinutes(minutes)
  if (parsed === null) notFound()
  return <BtrSessionRunner minutes={parsed} />
}
