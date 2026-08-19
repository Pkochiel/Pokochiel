import Link from 'next/link'
import { ButtonLink } from '@/components/ui/button'

const PIPELINE = [
  '高速視認',
  '意味認識',
  '構造化',
  '重要度判断',
  '速度切替',
  '理解',
  '想起',
  '長期記憶',
]

const TRAINING_HIGHLIGHTS = [
  {
    name: 'Speed Push',
    description: '普段より少し速い速度で読む経験をつくる。理解度に応じて速度を上下させる。',
  },
  {
    name: 'Chunk Reading',
    description: '文字単位ではなく意味のまとまりで認識する。意味単位の内部は割らない。',
  },
  {
    name: 'Structure Reading',
    description: '「結局この段落は何を言っている？」を掴む。速読能力の中核。',
  },
  {
    name: 'Recall',
    description: '本文を隠して再現する。翌日にもう一度問い、長期記憶を測る。',
  },
]

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
      <p className="text-xs font-semibold tracking-[0.2em] text-brand uppercase">
        Speed Reading Lab
      </p>

      <h1 className="mt-5 text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
        読む速度を上げるのではなく、
        <br className="hidden sm:block" />
        速く理解し、選び、思い出せる力を鍛える。
      </h1>

      <p className="mt-6 max-w-2xl text-base leading-relaxed text-fg-muted sm:text-lg">
        1日20〜30分。読書速度・チャンク認識・構造把握・要点抽出・即時想起・長期記憶を、
        測定しながら継続的にトレーニングします。日本語の文章を対象に、CPM（1分あたりの文字数）を
        主要指標として能力を可視化します。
      </p>

      <div className="mt-9 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/baseline" size="lg">
          Baseline Test を受ける
        </ButtonLink>
        <ButtonLink href="/dashboard" size="lg" variant="secondary">
          Dashboard を見る
        </ButtonLink>
      </div>

      <section className="mt-16 rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <h2 className="text-sm font-semibold tracking-wide text-fg-muted uppercase">
          鍛えるパイプライン
        </h2>
        <ol className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-3">
          {PIPELINE.map((step, i) => (
            <li key={step} className="flex items-center gap-2">
              <span className="rounded-lg bg-surface-muted px-3 py-1.5 text-sm font-medium">
                {step}
              </span>
              {i < PIPELINE.length - 1 ? (
                <span aria-hidden className="text-fg-subtle">
                  →
                </span>
              ) : null}
            </li>
          ))}
        </ol>
        <p className="mt-5 text-sm leading-relaxed text-fg-muted">
          目を速く動かすことは目的ではありません。読んだ内容を構造として掴み、重要度に応じて速度を
          切り替え、後から取り出せる状態にすることを目指します。
        </p>
      </section>

      <section className="mt-10 grid gap-4 sm:grid-cols-2">
        {TRAINING_HIGHLIGHTS.map((t) => (
          <article key={t.name} className="rounded-2xl border border-border bg-surface p-6">
            <h3 className="text-base font-semibold">{t.name}</h3>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">{t.description}</p>
          </article>
        ))}
      </section>

      <section className="mt-10 rounded-2xl border border-border bg-surface-muted p-6 sm:p-8">
        <h2 className="text-base font-semibold">扱わないこと</h2>
        <p className="mt-3 text-sm leading-relaxed text-fg-muted">
          ページを写真のように丸暗記する、脳内音読を完全に消す、一瞬見ただけで全文を記憶する
          — こうした科学的根拠の弱い能力を成果として謳いません。速度は指標のひとつであり、
          理解と記憶を伴わない速度を目標にしません。
        </p>
      </section>

      <footer className="mt-16 border-t border-border pt-6 text-sm text-fg-subtle">
        <Link href="/dashboard" className="hover:text-fg">
          Dashboard
        </Link>
        <span className="mx-2">·</span>
        <Link href="/progress" className="hover:text-fg">
          Progress
        </Link>
        <span className="mx-2">·</span>
        <Link href="/settings" className="hover:text-fg">
          Settings
        </Link>
      </footer>
    </main>
  )
}
