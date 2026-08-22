import Link from 'next/link'
import { ButtonLink } from '@/components/ui/button'
import { BTR_SESSION_MINUTES } from '@/core/planner/btr-session'
import { BTR_CATALOG, BTR_STAGE_LABELS, type BtrStage } from './btr-catalog'

/**
 * BTR の入口。
 *
 * 通しでやるのが本筋なので、まず長さを選ばせる。
 * その下に種目の一覧を置き、1種目だけ練習することもできるようにしておく。
 */

const STAGES: BtrStage[] = ['prepare', 'field', 'focus', 'reading']

/** 長さごとの一言。何が入って何が入らないかが分かるようにする。 */
const DURATION_NOTES: Record<number, string> = {
  90: '教室の1回と同じ長さ。4段階をひととおり通す',
  45: '認知視野と処理系から2種目ずつ。倍速読書まで',
  30: '認知視野と処理系から1種目ずつ。倍速読書まで',
  15: 'サッケイドと1種目、倍速読書だけ',
}

export function BtrCatalogView() {
  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-5 py-12 sm:px-8">
      <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">BTR メソッド</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">今日はどれくらい取れますか</h1>
      <p className="mt-4 text-sm leading-relaxed text-fg-muted">
        選んだ長さに合わせて種目を組みます。どの長さでもサッケイドと倍速読書は入ります。
        入口（眼）と出口（実際の読書）を欠くと、その日が何のためだったか分からなくなるためです。
      </p>

      <ul className="mt-6 space-y-2">
        {BTR_SESSION_MINUTES.map((minutes) => (
          <li key={minutes}>
            <Link
              href={`/btr/session/${minutes}`}
              className="flex items-baseline gap-4 rounded-2xl border border-border bg-surface p-4 transition-colors hover:bg-surface-muted"
            >
              <span className="tabular w-16 shrink-0 text-lg font-semibold">{minutes} 分</span>
              <span className="text-xs leading-relaxed text-fg-muted">
                {DURATION_NOTES[minutes]}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mt-12 text-lg font-semibold tracking-tight">1種目だけ試す</h2>
      <p className="mt-2 text-sm leading-relaxed text-fg-muted">
        通しでやらずに、気になる種目だけ触ることもできます。記録は同じように残ります。
      </p>

      {STAGES.map((stage) => {
        const entries = BTR_CATALOG.filter((entry) => entry.stage === stage)
        if (entries.length === 0) return null

        return (
          <section key={stage} className="mt-8">
            <h3 className="text-sm font-medium text-fg-muted">{BTR_STAGE_LABELS[stage]}</h3>
            <ul className="mt-3 space-y-2">
              {entries.map((entry) => (
                <li key={entry.slug}>
                  <Link
                    href={`/btr/${entry.slug}`}
                    className="block rounded-2xl border border-border bg-surface p-4 transition-colors hover:bg-surface-muted"
                  >
                    <span className="font-medium">{entry.name}</span>
                    <span className="mt-1 block text-xs leading-relaxed text-fg-muted">
                      {entry.summary}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )
      })}

      <ButtonLink href="/dashboard" variant="secondary" className="mt-10 w-full sm:w-auto">
        Dashboard へ
      </ButtonLink>
    </main>
  )
}
