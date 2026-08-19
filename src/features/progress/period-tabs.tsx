'use client'

import { useState } from 'react'
import { cn } from '@/lib/cn'

const PERIODS = [7, 30, 90] as const
export type PeriodDays = (typeof PERIODS)[number]

export function PeriodTabs({
  onChange,
}: {
  onChange?: (days: PeriodDays) => void
}) {
  const [active, setActive] = useState<PeriodDays>(30)

  return (
    <div role="tablist" aria-label="表示期間" className="inline-flex rounded-xl bg-surface-muted p-1">
      {PERIODS.map((days) => (
        <button
          key={days}
          type="button"
          role="tab"
          aria-selected={active === days}
          onClick={() => {
            setActive(days)
            onChange?.(days)
          }}
          className={cn(
            'rounded-lg px-4 py-1.5 text-sm transition-colors',
            active === days ? 'bg-surface font-medium text-fg shadow-sm' : 'text-fg-muted',
          )}
        >
          {days} days
        </button>
      ))}
    </div>
  )
}
