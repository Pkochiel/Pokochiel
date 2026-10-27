import type { Metadata } from 'next'
import { BtrCatalogView } from '@/features/training/btr/btr-catalog-view'

export const metadata: Metadata = { title: 'BTR トレーニング' }

export default function BtrIndexPage() {
  return <BtrCatalogView />
}
