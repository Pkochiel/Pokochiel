'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { ProgressBar } from '@/components/ui/progress-bar'
import { cpmForBand, scoreVariableSpeed, type SegmentChoice } from '@/core/training/variable-speed'
import type { SpeedBand } from '@/core/types'
import { cn } from '@/lib/cn'
import { formatInteger } from '@/lib/format'
import type { TrainingBlockProps } from '../shared/types'
import { useVariableSpeedPacer, type SegmentDwell } from './use-variable-speed-pacer'

type Phase = 'intro' | 'reading' | 'result'

const BANDS: { band: SpeedBand; label: string; key: string }[] = [
  { band: 'slow', label: 'Slow', key: '←' },
  { band: 'normal', label: 'Normal', key: 'Space' },
  { band: 'fast', label: 'Fast', key: '→' },
]

const IMPORTANCE_LABELS = {
  known: '既知',
  example: '具体例',
  evidence: '根拠',
  claim: '主張',
  key: '核心',
} as const

/**
 * Training 06: Variable Speed Reading
 *
 * 鍛える能力：情報の価値に応じて読む速度を切り替える力（Adaptive Reading）。
 * 測り方：区間ごとに選んだ速度が推奨帯とどれだけ一致したかで採点する。
 *
 * 速く読めたかどうかでは採点しない。主張を速く読み飛ばした場合は追加で減点し、
 * 「全部速く読む」が高得点にならないようにしてある。
 */
export function VariableSpeedBlock({ passage, targetCpm, onComplete }: TrainingBlockProps) {
  const segments = useMemo(() => passage.speedSegments ?? [], [passage.speedSegments])
  const [phase, setPhase] = useState<Phase>('intro')
  const [choices, setChoices] = useState<SegmentChoice[]>([])

  const handleSegmentComplete = useCallback(
    (dwell: SegmentDwell, band: SpeedBand) => {
      const segment = segments.find((s) => s.paragraphIndex === dwell.paragraphIndex)
      if (!segment) return
      // 実際に最も長く滞在した速度帯を、その区間の選択として記録する
      const dominant = (Object.entries(dwell.dwellByBand) as [SpeedBand, number][]).reduce(
        (best, entry) => (entry[1] > best[1] ? entry : best),
        ['normal', -1] as [SpeedBand, number],
      )[0]
      setChoices((current) => [
        ...current,
        {
          paragraphIndex: segment.paragraphIndex,
          importance: segment.importance,
          recommendedBand: segment.recommendedBand,
          chosenBand: dwell.dwellByBand[dominant] > 0 ? dominant : band,
          dwellMs: Object.values(dwell.dwellByBand).reduce((a, b) => a + b, 0),
        },
      ])
    },
    [segments],
  )

  const pacer = useVariableSpeedPacer({
    segments: segments.map((s) => ({ paragraphIndex: s.paragraphIndex, text: s.text })),
    targetCpm,
    onSegmentComplete: handleSegmentComplete,
    onFinish: useCallback(() => setPhase('result'), []),
  })

  // キーボード操作: ← Slow / Space Normal / → Fast
  useEffect(() => {
    if (phase !== 'reading') return
    const onKeyDown = (event: KeyboardEvent) => {
      const map: Record<string, SpeedBand> = {
        ArrowLeft: 'slow',
        Space: 'normal',
        ArrowRight: 'fast',
      }
      const band = map[event.code]
      if (!band) return
      event.preventDefault()
      pacer.setBand(band)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [phase, pacer])

  if (segments.length === 0) {
    return (
      <Centered>
        <p className="text-sm text-fg-muted">この教材には区間の定義がありません。</p>
        <Button className="mt-6 w-full sm:w-auto" onClick={() => onComplete({})}>
          次へ進む
        </Button>
      </Centered>
    )
  }

  if (phase === 'intro') {
    return (
      <Centered>
        <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
          Variable Speed Reading
        </p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{passage.title}</h1>
        <p className="mt-4 text-sm leading-relaxed text-fg-muted">
          段落ごとに読む速度を自分で切り替えます。主張や核心は落として読み、
          既知の情報や具体例は速く通過します。全 {segments.length} 区間。
        </p>
        <ul className="mt-4 space-y-1 text-xs text-fg-subtle">
          <li>← / Slow ボタン: {formatInteger(cpmForBand(targetCpm, 'slow'))} 字/分</li>
          <li>Space / Normal ボタン: {formatInteger(targetCpm)} 字/分</li>
          <li>→ / Fast ボタン: {formatInteger(cpmForBand(targetCpm, 'fast'))} 字/分</li>
        </ul>
        <p className="mt-3 text-xs text-fg-subtle">
          速く読むほど高得点にはなりません。どこで落としたかを見ています。
        </p>
        <Button
          size="lg"
          className="mt-8 w-full sm:w-auto"
          onClick={() => {
            setChoices([])
            setPhase('reading')
            pacer.start()
          }}
        >
          Start
        </Button>
      </Centered>
    )
  }

  if (phase === 'reading') {
    const segment = segments[pacer.segmentIndex]
    if (!segment) return null
    const readChars = Math.floor(pacer.position)

    return (
      <>
        <ProgressBar
          value={(pacer.segmentIndex + pacer.segmentProgress) / segments.length}
          className="fixed inset-x-0 top-0 h-1 rounded-none"
          label="進捗"
        />
        <main className="mx-auto flex min-h-dvh max-w-3xl flex-col justify-center px-5 pb-40 sm:px-8">
          <p className="tabular text-xs text-fg-subtle">
            区間 {pacer.segmentIndex + 1} / {segments.length}
          </p>
          <p className="reading-body reading-serif mt-4">
            <span>{segment.text.slice(0, readChars)}</span>
            <span className="text-fg-subtle">{segment.text.slice(readChars)}</span>
          </p>
        </main>

        <div className="fixed inset-x-0 bottom-0 bg-reading-bg/95 px-5 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur sm:px-8">
          <div className="mx-auto max-w-3xl">
            <div className="grid grid-cols-3 gap-2">
              {BANDS.map(({ band, label, key }) => (
                <button
                  key={band}
                  type="button"
                  onClick={() => pacer.setBand(band)}
                  aria-pressed={pacer.band === band}
                  className={cn(
                    'rounded-xl border py-3 text-sm font-medium transition-colors',
                    pacer.band === band
                      ? 'border-brand bg-brand-soft text-brand'
                      : 'border-border',
                  )}
                >
                  {label}
                  <span className="ml-1 hidden text-[10px] text-fg-subtle sm:inline">{key}</span>
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={pacer.skip}
              className="mt-2 w-full py-2 text-xs text-fg-subtle hover:text-fg-muted"
            >
              この区間を読み終えた
            </button>
          </div>
        </div>
      </>
    )
  }

  const result = scoreVariableSpeed(choices)
  return (
    <Centered>
      <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
        Variable Speed
      </p>
      <h2 className="mt-3 flex items-baseline gap-2 text-3xl font-semibold">
        <span className="tabular">{result.score}</span>
        <span className="text-sm font-normal text-fg-muted">
          / 100（{result.matched} / {result.total} 区間が推奨どおり）
        </span>
      </h2>

      {result.shouldHaveSlowed.length > 0 ? (
        <p className="mt-4 rounded-xl border border-border bg-surface-muted p-4 text-sm leading-relaxed text-fg-muted">
          落とすべきだった区間が {result.shouldHaveSlowed.length} か所あります。
          主張や核心は、速度を落とさないと取りこぼします。
        </p>
      ) : null}

      <ul className="mt-6 space-y-2">
        {result.segments.map((segment) => (
          <li
            key={segment.paragraphIndex}
            className={cn(
              'rounded-xl border p-4 text-sm',
              segment.score === 100 ? 'border-border' : 'border-accent',
            )}
          >
            <p className="flex items-center gap-2 text-xs text-fg-muted">
              <span className="rounded-full bg-surface-muted px-2 py-0.5">
                {IMPORTANCE_LABELS[segment.importance]}
              </span>
              <span>
                推奨 {segment.recommendedBand} / 実際 {segment.chosenBand}
              </span>
            </p>
            <p className="mt-2 leading-relaxed">{segment.message}</p>
          </li>
        ))}
      </ul>

      <Button
        size="lg"
        className="mt-6 w-full sm:w-auto"
        onClick={() =>
          onComplete({ accuracyScore: result.score, questionCount: result.total })
        }
      >
        次へ
      </Button>
    </Centered>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center px-5 py-16 sm:px-8">
      {children}
    </main>
  )
}
