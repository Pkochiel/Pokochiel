'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  IMAGE_MEMORY,
  scoreImageMemory,
  type ImageMemorySet,
} from '@/core/training/btr/image-memory'
import { pickImageWords } from '@/data/content/image-words'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { BtrIntro, BtrResult, BtrTimerBar } from './shared/btr-shell'
import { useCountdown } from './shared/use-countdown'
import { VerticalText } from './shared/vertical-text'
import type { BtrBlockProps } from './shared/btr-block'

/**
 * イメージ記憶 / イメージボード（BTRメソッド 読書内容への集中）
 *
 * 40語を制限時間で覚え、思い出せたものを書き出す。**同じ語で2セット**。
 * 級が上がるごとに制限時間が短くなる（2分 → 1分30秒 → 1分 → 45秒 → 30秒）。
 *
 * 画面は実物のシートと同じ形にする。**1語を1列の縦書きで置き、
 * そのすぐ下に解答欄の枠を並べる。右から左へ読む。**
 *
 * 解答欄は語と同じ数だけあるが、**どの欄にどの語を入れるかは問わない**。
 * 位置まで合わせる形にすると、順序の記憶という別の課題になってしまう。
 * 紙のシートでも、覚えた語を思い出した順に書いていく。
 */

export type ImageMemoryBlockProps = BtrBlockProps

type Phase = 'intro' | 'memorize' | 'recall' | 'result'

export function ImageMemoryBlock({ seed, level = 0, onComplete }: ImageMemoryBlockProps) {
  const [phase, setPhase] = useState<Phase>('intro')
  const [setIndex, setSetIndex] = useState(0)
  const [sets, setSets] = useState<ImageMemorySet[]>([])

  const words = useMemo(() => pickImageWords(seed), [seed])
  const timeLimitMs =
    IMAGE_MEMORY.timeLimits[Math.min(level, IMAGE_MEMORY.timeLimits.length - 1)] ??
    IMAGE_MEMORY.timeLimits[0]!

  const submitRecall = (recalled: readonly string[]) => {
    const next = [...sets, { index: setIndex, recalled: [...recalled] }]
    setSets(next)

    if (next.length >= IMAGE_MEMORY.sets) setPhase('result')
    else {
      setSetIndex(next.length)
      setPhase('memorize')
    }
  }

  if (phase === 'intro') {
    return (
      <BtrIntro
        stage="読書内容への集中"
        title="イメージ記憶"
        onStart={() => {
          setSets([])
          setSetIndex(0)
          setPhase('memorize')
        }}
      >
        <p>
          {words.length} 個の語を {Math.round(timeLimitMs / 1000)} 秒で覚え、
          思い出せたものを下の欄に書き出します。
          <strong className="text-fg">
            同じ語で {IMAGE_MEMORY.sets} セット行います。
          </strong>
        </p>
        <p>
          語は縦書きで右から左へ並びます。隣り合う語を結ぶ場面をひとつ思い浮かべると残ります。
          ばかばかしいほど鮮明なイメージほど、あとで出てきます。
        </p>
        <p className="text-xs">
          どの欄にどの語を入れるかは問いません。思い出した順に入れてください。
        </p>
      </BtrIntro>
    )
  }

  if (phase === 'memorize') {
    return (
      <MemorizeRun
        key={setIndex}
        words={words}
        setNumber={setIndex + 1}
        timeLimitMs={timeLimitMs}
        onFinish={() => setPhase('recall')}
      />
    )
  }

  if (phase === 'recall') {
    return (
      <RecallSheet
        key={setIndex}
        slotCount={words.length}
        setNumber={setIndex + 1}
        onSubmit={submitRecall}
      />
    )
  }

  const result = scoreImageMemory(words, sets)
  return (
    <BtrResult
      title="イメージ記憶"
      score={result.score}
      scoreUnit={`語（${result.attempts.join('・')}）`}
      lines={[
        { label: 'どちらかで思い出せた語', value: `${result.unionRecalled} / ${result.total}` },
        {
          label: '出題になかった語',
          value: `${result.sets.reduce((sum, set) => sum + set.intruded, 0)} 個`,
        },
      ]}
      note={`主スコアは ${IMAGE_MEMORY.sets} セットのうち良いほうです。合計にすると同じ語を二重に数えてしまいます。`}
      onNext={() =>
        onComplete({
          score: result.score,
          attempts: result.attempts,
          timeLimitMs,
          accuracy: Math.round((result.score / result.total) * 100),
        })
      }
    />
  )
}

/* ------------------------------------------------------------------ */
/* シート                                                              */
/* ------------------------------------------------------------------ */

interface SheetCell {
  /** 上に出す語。思い出す場面では出さない。 */
  readonly word: string | null
  /** 欄に入っている語。 */
  readonly filled: string | null
  /** 次に入る欄。どこまで進んだかが分かるようにする。 */
  readonly active: boolean
}

interface ImageSheetProps {
  readonly cells: readonly SheetCell[]
  /** 語の段を出すか。思い出す場面では空の段を置かず、欄だけを並べる。 */
  readonly showWords: boolean
  readonly onPick?: (index: number) => void
}

/**
 * シートそのもの。
 *
 * 実物と同じく、1語を1列の縦書きで置き、そのすぐ下に解答欄の枠を並べる。
 * `dir="rtl"` で右から左へ流す。列の中身は1字ずつ縦に積むので、
 * 右から左になっても字の並びは崩れない。
 *
 * 1行に並べる列数は幅で変える。実物は20列2段だが、
 * 手のひらの幅で20列に割ると1列が2文字ぶんも取れず、字が読めなくなる。
 */
function ImageSheet({ cells, showWords, onPick }: ImageSheetProps) {
  return (
    <div
      dir="rtl"
      className={cn(
        'grid grid-cols-10 gap-x-1 gap-y-4',
        'md:grid-cols-[repeat(20,minmax(0,1fr))] md:gap-x-1.5 md:gap-y-6',
      )}
    >
      {cells.map((cell, index) => (
        <div key={index} className="flex flex-col items-center">
          {showWords ? (
            // 短い語でも4字ぶんの場所を取る。取らないと欄の高さが列ごとにずれる。
            <div className="flex h-[5.2em] items-start justify-center text-[13px] sm:text-sm">
              {cell.word === null ? null : <VerticalText text={cell.word} />}
            </div>
          ) : null}

          <SheetBox
            filled={cell.filled}
            active={cell.active}
            className={showWords ? 'mt-1.5' : ''}
            onPick={onPick === undefined ? undefined : () => onPick(index)}
          />
        </div>
      ))}
    </div>
  )
}

interface SheetBoxProps {
  readonly filled: string | null
  readonly active: boolean
  readonly className?: string
  readonly onPick?: () => void
}

/** 解答欄の枠ひとつ。 */
function SheetBox({ filled, active, className, onPick }: SheetBoxProps) {
  const shape = cn(
    'flex h-16 w-full items-center justify-center rounded-[3px] md:h-20',
    'border border-fg/45 bg-surface',
    active && 'border-brand ring-2 ring-brand/40',
    className,
  )

  const content =
    filled === null ? null : (
      <VerticalText
        // 長い語を入れられても枠からはみ出させない。
        className={[...filled].length > 4 ? 'text-[9px]' : 'text-[13px] sm:text-sm'}
        text={filled}
      />
    )

  if (onPick === undefined) return <div className={shape}>{content}</div>

  return (
    <button
      type="button"
      onClick={onPick}
      aria-label={filled === null ? '空の欄' : `${filled} を消す`}
      className={cn(shape, 'overflow-hidden transition-colors active:bg-surface-muted')}
    >
      {content}
    </button>
  )
}

/* ------------------------------------------------------------------ */
/* 覚える                                                              */
/* ------------------------------------------------------------------ */

interface MemorizeRunProps {
  readonly words: readonly string[]
  readonly setNumber: number
  readonly timeLimitMs: number
  readonly onFinish: () => void
}

/** 覚える時間。制限時間はこの部品の寿命と一致する。 */
function MemorizeRun({ words, setNumber, timeLimitMs, onFinish }: MemorizeRunProps) {
  const countdown = useCountdown({ durationMs: timeLimitMs, onFinish })
  const { start } = countdown
  useEffect(() => start(), [start])

  const cells = words.map((word): SheetCell => ({ word, filled: null, active: false }))

  return (
    <>
      <BtrTimerBar
        remainingMs={countdown.remainingMs}
        progress={countdown.progress}
        detail={`${setNumber} / ${IMAGE_MEMORY.sets} セット目・覚える`}
      />
      <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col justify-center px-3 pt-14 pb-6 sm:px-8">
        <ImageSheet cells={cells} showWords />
        <Button
          variant="ghost"
          size="sm"
          className="mx-auto mt-6"
          onClick={() => countdown.finish()}
        >
          覚えた・先へ進む
        </Button>
      </main>
    </>
  )
}

/* ------------------------------------------------------------------ */
/* 思い出す                                                            */
/* ------------------------------------------------------------------ */

interface RecallSheetProps {
  readonly slotCount: number
  readonly setNumber: number
  readonly onSubmit: (recalled: readonly string[]) => void
}

/** 語の区切り。読点でも空白でも続けて入れられるようにする。 */
const SEPARATORS = /[、,・\s　]+/

function RecallSheet({ slotCount, setNumber, onSubmit }: RecallSheetProps) {
  const [entries, setEntries] = useState<readonly string[]>(() =>
    Array.from({ length: slotCount }, () => ''),
  )
  const [draft, setDraft] = useState('')

  const filledCount = entries.filter((entry) => entry.length > 0).length
  const nextIndex = entries.indexOf('')

  const commit = () => {
    const parts = draft
      .split(SEPARATORS)
      .map((part) => part.trim())
      .filter((part) => part.length > 0)
    setDraft('')
    if (parts.length === 0) return

    setEntries((current) => {
      const next = [...current]
      let cursor = 0
      for (const part of parts) {
        while (cursor < next.length && next[cursor] !== '') cursor += 1
        if (cursor >= next.length) break
        next[cursor] = part
      }
      return next
    })
  }

  const cells = entries.map(
    (entry, index): SheetCell => ({
      word: null,
      filled: entry.length > 0 ? entry : null,
      active: index === nextIndex,
    }),
  )

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col px-3 pt-6 pb-3 sm:px-8">
      <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
        {setNumber} / {IMAGE_MEMORY.sets} セット目
      </p>
      <h2 className="mt-2 text-lg font-medium sm:text-xl">思い出せた語を入れてください</h2>
      <p className="mt-2 text-sm text-fg-muted">
        順番は問いません。入れた語は右の欄から順に埋まります。欄を押すと消せます。
      </p>

      <div className="mt-5 flex-1">
        <ImageSheet
          cells={cells}
          showWords={false}
          onPick={(index) =>
            setEntries((current) => current.map((entry, i) => (i === index ? '' : entry)))
          }
        />
      </div>

      <div className="sticky bottom-0 -mx-3 mt-6 bg-bg/95 px-3 pt-3 pb-2 backdrop-blur-sm sm:-mx-8 sm:px-8">
        <div className="flex items-center gap-2">
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' || event.nativeEvent.isComposing) return
              event.preventDefault()
              commit()
            }}
            enterKeyHint="next"
            autoFocus
            disabled={nextIndex < 0}
            placeholder={nextIndex < 0 ? '欄が埋まりました' : '思い出した語'}
            aria-label="思い出した語"
            className="min-w-0 flex-1 rounded-xl border border-border bg-surface px-4 py-3 text-base disabled:opacity-50"
          />
          <Button onClick={commit} disabled={draft.trim().length === 0}>
            入れる
          </Button>
        </div>

        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="tabular text-xs text-fg-muted">
            {filledCount} / {slotCount} 欄
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onSubmit(entries.filter((entry) => entry.length > 0))}
          >
            {setNumber >= IMAGE_MEMORY.sets ? '結果へ' : '次のセットへ'}
          </Button>
        </div>
      </div>
    </main>
  )
}
