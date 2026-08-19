import { Stat } from '@/components/ui/stat'

export interface DashboardStats {
  currentCpm: number | null
  comprehension: number | null
  immediateRecall: number | null
  nextDayRecall: number | null
  streakDays: number
  ers: number | null
}

const EMPTY = '—'

const format = (value: number | null, digits = 0): string =>
  value === null ? EMPTY : value.toFixed(digits)

export function StatsGrid({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      <Stat
        label="Current CPM"
        value={format(stats.currentCpm)}
        unit="字/分"
        tone="brand"
        hint="直近の読書速度"
      />
      <Stat label="Comprehension" value={format(stats.comprehension)} unit="%" hint="理解度テスト" />
      <Stat
        label="Immediate Recall"
        value={format(stats.immediateRecall)}
        unit="%"
        hint="直後の想起"
      />
      <Stat
        label="Next-day Recall"
        value={format(stats.nextDayRecall)}
        unit="%"
        hint="翌日の想起（長期記憶）"
      />
      <Stat
        label="Streak"
        value={String(stats.streakDays)}
        unit="日"
        tone="accent"
        hint="連続実施日数"
      />
      <Stat
        label="ERS"
        value={format(stats.ers)}
        hint="速度 × 理解 × 想起"
      />
    </div>
  )
}
