import Link from 'next/link'
import { ButtonLink } from '@/components/ui/button'
import { BTR_EXERCISES, BTR_STAGE_LABELS, type BtrStage } from '@/core/training/btr/exercises'
import { PACED_READING } from '@/core/training/btr/paced-reading'

const STAGES: BtrStage[] = ['prepare', 'field', 'focus', 'reading']

const STAGE_NOTES: Record<BtrStage, string> = {
  prepare: '呼吸を整えてから始める。散らかった頭のままでは、どの訓練も入らない',
  field: '一度に見て取れる範囲を広げる。文字を追う速さではなく、視野そのものを広げる',
  focus: '見たものを保ったまま処理する。ここがワーキングメモリの訓練にあたる',
  reading: '実際の本を読む。訓練の出口をここに置かないと、何のためだったか分からなくなる',
}

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
      <p className="text-xs font-semibold tracking-[0.2em] text-brand uppercase">
        Speed Reading Lab
      </p>

      <h1 className="mt-5 text-3xl leading-tight font-semibold tracking-tight text-balance sm:text-5xl">
        目を速く動かす訓練ではなく、
        <br className="hidden sm:block" />
        読んだ内容を保っていられる力を鍛える。
      </h1>

      <p className="mt-6 max-w-2xl text-base leading-relaxed text-fg-muted sm:text-lg">
        BTRメソッド（Basic Training for Readers）に沿って作っています。
        速読の中核はワーキングメモリであって、眼球運動の速さではありません。
        目標は実用的な <strong className="text-fg">{PACED_READING.targetMultiplier} 倍</strong>
        で、1日 15 分から続けられます。
      </p>

      <div className="mt-9 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/btr" size="lg">
          トレーニングを始める
        </ButtonLink>
        <ButtonLink href="/baseline" size="lg" variant="secondary">
          はじめに速度を測る
        </ButtonLink>
      </div>

      <section className="mt-16 space-y-4">
        <h2 className="text-sm font-semibold tracking-wide text-fg-muted uppercase">
          1回の流れ
        </h2>
        {STAGES.map((stage, index) => (
          <article key={stage} className="rounded-2xl border border-border bg-surface p-6">
            <h3 className="flex items-baseline gap-3 text-base font-semibold">
              <span className="tabular text-brand">{index + 1}</span>
              {BTR_STAGE_LABELS[stage]}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-fg-muted">{STAGE_NOTES[stage]}</p>
            <p className="mt-3 text-xs text-fg-subtle">
              {BTR_EXERCISES.filter((spec) => spec.stage === stage)
                .map((spec) => spec.name)
                .join('・')}
            </p>
          </article>
        ))}
      </section>

      <section className="mt-10 rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <h2 className="text-base font-semibold">級は「制限時間の短さ」で上がる</h2>
        <p className="mt-3 text-sm leading-relaxed text-fg-muted">
          上達を「速く読めたか」で測ると、読んだつもりで飛ばすだけで数字が上がってしまいます。
          同じ課題を短い時間でこなせるようになったかを見ます。級は種目ごとに独立しているので、
          得意な種目に引きずられて苦手な種目まで難しくなることはありません。
        </p>
      </section>

      <section className="mt-10 rounded-2xl border border-border bg-surface-muted p-6 sm:p-8">
        <h2 className="text-base font-semibold">扱わないこと</h2>
        <p className="mt-3 text-sm leading-relaxed text-fg-muted">
          「1分で1冊」「10倍20倍」は謳いません。ページを写真のように丸暗記する、
          脳内音読を完全に消す、一瞬見ただけで全文を記憶する
          — こうした根拠の弱い能力も成果としません。
          速度は指標のひとつであって、理解と記憶を伴わない速度を目標にしません。
        </p>
      </section>

      <footer className="mt-16 border-t border-border pt-6 text-sm text-fg-subtle">
        <Link href="/dashboard" className="hover:text-fg">
          ホーム
        </Link>
        <span className="mx-2">·</span>
        <Link href="/progress" className="hover:text-fg">
          推移
        </Link>
        <span className="mx-2">·</span>
        <Link href="/settings" className="hover:text-fg">
          設定
        </Link>
      </footer>
    </main>
  )
}
