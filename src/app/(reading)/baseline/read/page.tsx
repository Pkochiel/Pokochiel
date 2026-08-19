import type { Metadata } from 'next'
import { getBaselinePassage } from '@/data/content'
import { BaselineExperience } from '@/features/baseline/baseline-experience'

export const metadata: Metadata = { title: 'Baseline Test' }

export default function BaselineReadPage() {
  return <BaselineExperience passage={getBaselinePassage()} />
}
