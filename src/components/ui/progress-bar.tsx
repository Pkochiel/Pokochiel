import { cn } from '@/lib/cn'

type Tone = 'brand' | 'accent'

const TONES: Record<Tone, string> = {
  brand: 'bg-brand',
  accent: 'bg-accent',
}

export interface ProgressBarProps {
  /** 0–1 */
  value: number
  className?: string
  tone?: Tone
  label?: string
}

export function ProgressBar({ value, className, tone = 'brand', label }: ProgressBarProps) {
  const clamped = Math.min(1, Math.max(0, value))
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-muted', className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
      aria-label={label}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-300', TONES[tone])}
        style={{ width: `${clamped * 100}%` }}
      />
    </div>
  )
}
