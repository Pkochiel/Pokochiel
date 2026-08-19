import { ProgressBar } from '@/components/ui/progress-bar'
import { formatDuration, formatInteger } from '@/lib/format'

export interface TrainingHudProps {
  title: string
  elapsedSeconds: number
  /** 進行中に表示する速度。測定中に伏せたい場合は省略する。 */
  cpm?: number | null
  /** 0–1 */
  progress?: number
}

/**
 * トレーニング中の情報表示。
 * 表示するのは「何を・どれだけ・どの速さで」の3点のみ。それ以外は置かない。
 */
export function TrainingHud({ title, elapsedSeconds, cpm, progress }: TrainingHudProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-10 bg-reading-bg/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-baseline justify-between px-5 py-3 sm:px-8">
        <span className="text-xs font-medium tracking-wide text-fg-muted">{title}</span>
        <span className="flex items-baseline gap-4">
          <span className="tabular text-sm font-medium">{formatDuration(elapsedSeconds)}</span>
          {cpm !== undefined && cpm !== null ? (
            <span className="tabular text-sm text-fg-muted">{formatInteger(cpm)} CPM</span>
          ) : null}
        </span>
      </div>
      {progress === undefined ? null : (
        <ProgressBar value={progress} className="h-1 rounded-none" label="進捗" />
      )}
    </header>
  )
}
