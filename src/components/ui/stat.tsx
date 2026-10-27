import { cn } from '@/lib/cn'

export interface StatProps {
  label: string
  value: string
  unit?: string
  hint?: string
  tone?: 'default' | 'brand' | 'accent'
}

const TONES = {
  default: 'text-fg',
  brand: 'text-brand',
  accent: 'text-accent',
} as const

/** Dashboard の指標タイル。値・単位・補足の3層で構成する。 */
export function Stat({ label, value, unit, hint, tone = 'default' }: StatProps) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs font-medium tracking-wide text-fg-muted uppercase">{label}</p>
      <p className={cn('mt-2 flex items-baseline gap-1', TONES[tone])}>
        <span className="tabular text-2xl font-semibold sm:text-3xl">{value}</span>
        {unit ? <span className="text-xs text-fg-muted">{unit}</span> : null}
      </p>
      {hint ? <p className="mt-1 text-xs text-fg-subtle">{hint}</p> : null}
    </div>
  )
}
