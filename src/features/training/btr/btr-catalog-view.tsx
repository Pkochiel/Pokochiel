import Link from 'next/link'
import { ButtonLink } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { BTR_CATALOG, BTR_STAGE_LABELS, type BtrStage } from './btr-catalog'

/**
 * BTR の種目の一覧。
 *
 * セッション構成の置き換えはまだなので、ここから1種目ずつ開いて試す。
 * できていない種目も並べておく。何が残っているかが見えているほうがよい。
 */

const STAGES: BtrStage[] = ['prepare', 'field', 'focus', 'reading']

export function BtrCatalogView() {
  const ready = BTR_CATALOG.filter((entry) => entry.Component !== null).length

  return (
    <main className="mx-auto min-h-dvh max-w-2xl px-5 py-12 sm:px-8">
      <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">BTR メソッド</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">トレーニング一覧</h1>
      <p className="mt-4 text-sm leading-relaxed text-fg-muted">
        クリエイト速読スクールの BTRメソッドに合わせて作り直している途中です。
        いま開けるのは {ready} / {BTR_CATALOG.length} 種目。
        まとまったセッションとして通せるようにするのはこの後です。
      </p>

      {STAGES.map((stage) => {
        const entries = BTR_CATALOG.filter((entry) => entry.stage === stage)
        if (entries.length === 0) return null

        return (
          <section key={stage} className="mt-10">
            <h2 className="text-sm font-medium text-fg-muted">{BTR_STAGE_LABELS[stage]}</h2>
            <ul className="mt-3 space-y-2">
              {entries.map((entry) => {
                const available = entry.Component !== null
                const body = (
                  <>
                    <span className="flex items-baseline gap-2">
                      <span className="font-medium">{entry.name}</span>
                      {!available ? (
                        <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] text-fg-subtle">
                          準備中
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-fg-muted">
                      {entry.summary}
                    </span>
                  </>
                )

                return (
                  <li key={entry.slug}>
                    {available ? (
                      <Link
                        href={`/btr/${entry.slug}`}
                        className="block rounded-2xl border border-border bg-surface p-4 transition-colors hover:bg-surface-muted"
                      >
                        {body}
                      </Link>
                    ) : (
                      <div
                        className={cn(
                          'block rounded-2xl border border-border border-dashed p-4 opacity-60',
                        )}
                      >
                        {body}
                      </div>
                    )}
                  </li>
                )
              })}
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
