import type { Metadata } from 'next'
import { DailyTraining } from '@/features/training/daily-training'

export const metadata: Metadata = { title: 'Today’s Training' }

export default function TrainingPage() {
  return <DailyTraining />
}
