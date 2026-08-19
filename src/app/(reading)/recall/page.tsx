import type { Metadata } from 'next'
import { DelayedRecallBlock } from '@/features/recall/delayed-recall-block'

export const metadata: Metadata = { title: 'Recall' }

export default function RecallPage() {
  return <DelayedRecallBlock />
}
