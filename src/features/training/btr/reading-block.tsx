'use client'

import { useEffect, useState } from 'react'
import {
  PACED_READING,
  READING_MODE_LABELS,
  READING_REJECTION_MESSAGES,
  isValidCharsPerPage,
  scorePacedReading,
  type ReadingBook,
  type ReadingMode,
} from '@/core/training/btr/paced-reading'
import { getReadingBookShelf, type ReadingShelf } from '@/data/reading-books'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { BtrIntro, BtrResult, BtrScreen, BtrTimerBar } from './shared/btr-shell'
import { formatRemaining, useCountdown } from './shared/use-countdown'
import type { BtrBlockProps } from './shared/btr-block'

/**
 * 普通読書 / 倍速読書（BTRメソッド 仕上げ）
 *
 * **自分の本**を決まった時間だけ読み、読んだページ数を記録する。
 * 用意された教材ではなく実際の本を使うのがこの種目の要点である。
 *
 *   普通読書  いつもの読み方で読む。いまの自分の速さを測る
 *   倍速読書  意識して速く読む。訓練にあたる
 *
 * 2つは必ず分けて記録する。ひとつにまとめると、速く読もうとした日の数字が
 * ふだんの速さとして残り、伸びたのかその日がんばっただけなのかが分からなくなる。
 *
 * ページ数から字数を出すため、本の登録時に1ページの文字数を入れてもらう。
 * 本が変わったときだけ登録し直す。
 */

const MODES: readonly ReadingMode[] = ['normal', 'paced']

export type ReadingBlockProps = BtrBlockProps & {
  /**
   * 読み方を決め打ちする。1回の組み立ての中では、普通読書と倍速読書は
   * 別々のブロックとして並ぶので、その場で選ばせる必要がない。
   */
  readonly mode?: ReadingMode
}

type Phase = 'intro' | 'book' | 'mode' | 'running' | 'pages' | 'result'

export function ReadingBlock({ mode: fixedMode, onComplete }: ReadingBlockProps) {
  const [phase, setPhase] = useState<Phase>('intro')
  /**
   * 本の控えは localStorage にある。
   *
   * 最初の描画では読まない。ここで読むと、サーバで組んだ HTML と食い違って
   * 画面がちらつく。押されてから読めば、その時点ではもうブラウザにいる。
   */
  const [shelf, setShelf] = useState<ReadingShelf>({ books: [], currentId: null })
  const [book, setBook] = useState<ReadingBook | null>(null)
  const [mode, setMode] = useState<ReadingMode>(fixedMode ?? 'paced')
  const [pages, setPages] = useState('')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [finished, setFinished] = useState(false)

  if (phase === 'intro') {
    return (
      <BtrIntro
        stage="読書"
        title={fixedMode ? READING_MODE_LABELS[fixedMode] : '普通読書 / 倍速読書'}
        startLabel="本を選ぶ"
        onStart={() => {
          setShelf(getReadingBookShelf().load())
          setPhase('book')
        }}
      >
        <p>
          用意された文章ではなく、
          <strong className="text-fg">自分の本</strong>
          を読みます。決まった時間だけ読み、何ページ進んだかを記録します。
        </p>
        <p>
          ページ数から字数を出すので、はじめに
          <strong className="text-fg">1ページあたりの文字数</strong>
          を登録します。本が変わったときだけ入れ直してください。
        </p>
      </BtrIntro>
    )
  }

  if (phase === 'book') {
    return (
      <BookSetup
        shelf={shelf}
        onReady={(chosen) => {
          setBook(chosen)
          setPhase(fixedMode ? 'running' : 'mode')
        }}
        onShelfChange={setShelf}
      />
    )
  }

  if (phase === 'mode' && book) {
    return (
      <BtrScreen>
        <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">読書</p>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">どちらを読みますか</h1>
        <p className="mt-2 text-sm text-fg-muted">
          『{book.title}』・1ページ {book.charsPerPage} 字
        </p>

        <div className="mt-6 space-y-2">
          {MODES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setMode(value)
                setPhase('running')
              }}
              className="w-full rounded-xl border border-border bg-surface px-4 py-4 text-left transition-colors active:bg-surface-muted"
            >
              <span className="block text-base font-medium">{READING_MODE_LABELS[value]}</span>
              <span className="mt-0.5 block text-sm text-fg-muted">
                {value === 'normal'
                  ? 'いつもの読み方で。いまの自分の速さを測ります'
                  : '意識して速く。こちらが訓練にあたります'}
                ・{Math.round(PACED_READING.durationMs[value] / 60_000)} 分
              </span>
            </button>
          ))}
        </div>

        <p className="mt-5 text-sm leading-relaxed text-fg-muted">
          2つは分けて記録します。まとめてしまうと、速く読もうとした日の数字が
          ふだんの速さとして残ってしまいます。
        </p>
      </BtrScreen>
    )
  }

  if (phase === 'running' && book) {
    return (
      <ReadingRun
        mode={mode}
        title={book.title}
        onFinish={(ms) => {
          setElapsedMs(ms)
          setPhase('pages')
        }}
      />
    )
  }

  if (phase === 'pages' && book) {
    const value = Number(pages)
    const usable = Number.isFinite(value) && value > 0

    return (
      <BtrScreen>
        <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">
          {READING_MODE_LABELS[mode]}
        </p>
        <h2 className="mt-3 text-lg font-medium sm:text-xl">何ページ読めましたか</h2>
        <p className="mt-3 text-sm text-fg-muted">
          『{book.title}』・{formatDuration(elapsedMs)}
        </p>

        <div className="mt-5 flex items-baseline gap-3">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            value={pages}
            onChange={(event) => setPages(event.target.value)}
            autoFocus
            className="tabular w-32 rounded-xl border border-border bg-surface px-4 py-3 text-2xl font-semibold"
          />
          <span className="text-sm text-fg-muted">ページ</span>
        </div>

        <Button
          size="lg"
          className="mt-6 w-full sm:w-auto"
          disabled={!usable}
          onClick={() => setPhase('result')}
        >
          記録する
        </Button>
      </BtrScreen>
    )
  }

  if (phase === 'result' && book) {
    const result = scorePacedReading({
      mode,
      charsPerPage: book.charsPerPage,
      pages: Number(pages),
      elapsedMs,
    })

    return (
      <>
        <BtrResult
          title={`${READING_MODE_LABELS[mode]}・${book.title}`}
          score={result.cpm}
          scoreUnit="字 / 分"
          lines={[
            { label: '読んだページ', value: `${result.pages} ページ` },
            { label: '読んだ時間', value: formatDuration(result.elapsedMs) },
            { label: '分速', value: `${result.pagesPerMinute} ページ` },
            { label: '1ページの文字数', value: `${book.charsPerPage} 字` },
          ]}
          note={
            result.rejection !== null
              ? READING_REJECTION_MESSAGES[result.rejection]
              : mode === 'paced'
                ? '入会時の何倍になったかは、倍速読書の記録だけで測ります。'
                : 'この数字がいまのふだんの速さです。倍速読書の伸びは、ここを基準に見ます。'
          }
          nextLabel={result.valid ? '次へ' : '記録せずに次へ'}
          onNext={() =>
            onComplete({
              // 記録するのはページ数。分速はそこから出した数字なので別に持つ。
              // 読み方は種目そのものが分かれている（普通読書／倍速読書）ので
              // variant は付けない。付けると名前が二重になる。
              score: result.pages,
              cpm: result.cpm,
              elapsedMs: result.elapsedMs,
              valid: result.valid,
            })
          }
        />
        {!finished ? (
          <div className="mx-auto -mt-8 max-w-3xl px-5 pb-12 sm:px-8">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                getReadingBookShelf().finish(book.id)
                setFinished(true)
              }}
            >
              この本を読み切った
            </Button>
          </div>
        ) : null}
      </>
    )
  }

  // ここへは来ない（本を決める前に先の段へ進めない）。型を閉じるためだけに置く。
  return null
}

interface BookSetupProps {
  readonly shelf: ReadingShelf
  readonly onReady: (book: ReadingBook) => void
  readonly onShelfChange: (shelf: ReadingShelf) => void
}

/** 読む本を決める。控えにあれば選ぶだけ、なければ登録する。 */
function BookSetup({ shelf, onReady, onShelfChange }: BookSetupProps) {
  const [registering, setRegistering] = useState(false)
  const [title, setTitle] = useState('')
  const [charsPerPage, setCharsPerPage] = useState('')
  const [error, setError] = useState<string | null>(null)

  const unfinished = shelf.books.filter((book) => book.finishedAt === null)
  const showForm = registering || unfinished.length === 0
  const chars = Number(charsPerPage)
  const canRegister = title.trim().length > 0 && isValidCharsPerPage(chars)

  const register = () => {
    try {
      const book = getReadingBookShelf().register({ title, charsPerPage: chars })
      onShelfChange(getReadingBookShelf().load())
      onReady(book)
    } catch {
      setError('1ページの文字数を確かめてください。')
    }
  }

  return (
    <BtrScreen>
      <p className="text-xs font-semibold tracking-[0.18em] text-brand uppercase">読書</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight">
        {showForm ? '読む本を登録します' : 'どの本を読みますか'}
      </h1>

      {showForm ? (
        <>
          <p className="mt-4 text-sm leading-relaxed text-fg-muted">
            ページ数から字数を出すので、
            <strong className="text-fg">1ページあたりの文字数</strong>
            を入れてください。奥付の近くに書かれていることもありますが、
            1ページを数えて概算で構いません（文庫はおよそ 600 字）。
          </p>

          <label className="mt-6 block">
            <span className="text-xs text-fg-muted">本の名前</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-surface px-4 py-3 text-base"
            />
          </label>

          <label className="mt-4 block">
            <span className="text-xs text-fg-muted">
              1ページの文字数（{PACED_READING.minCharsPerPage}〜
              {PACED_READING.maxCharsPerPage}）
            </span>
            <input
              type="number"
              inputMode="numeric"
              value={charsPerPage}
              onChange={(event) => setCharsPerPage(event.target.value)}
              placeholder="620"
              className="tabular mt-1.5 w-40 rounded-xl border border-border bg-surface px-4 py-3 text-base"
            />
          </label>

          {error ? <p className="mt-3 text-sm text-negative">{error}</p> : null}

          <Button
            size="lg"
            className="mt-6 w-full sm:w-auto"
            disabled={!canRegister}
            onClick={register}
          >
            登録して読みはじめる
          </Button>

          {unfinished.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="mt-3"
              onClick={() => {
                setRegistering(false)
                setError(null)
              }}
            >
              控えから選ぶ
            </Button>
          ) : null}
        </>
      ) : (
        <>
          <div className="mt-6 space-y-2">
            {unfinished.map((book) => (
              <button
                key={book.id}
                type="button"
                onClick={() => {
                  getReadingBookShelf().select(book.id)
                  onShelfChange(getReadingBookShelf().load())
                  onReady(book)
                }}
                className={cn(
                  'w-full rounded-xl border bg-surface px-4 py-3.5 text-left transition-colors',
                  'active:bg-surface-muted',
                  book.id === shelf.currentId ? 'border-brand' : 'border-border',
                )}
              >
                <span className="block text-base font-medium">{book.title}</span>
                <span className="mt-0.5 block text-sm text-fg-muted">
                  1ページ {book.charsPerPage} 字
                </span>
              </button>
            ))}
          </div>

          <Button variant="ghost" size="sm" className="mt-4" onClick={() => setRegistering(true)}>
            別の本を登録する
          </Button>
        </>
      )}
    </BtrScreen>
  )
}

interface ReadingRunProps {
  readonly mode: ReadingMode
  readonly title: string
  readonly onFinish: (elapsedMs: number) => void
}

/**
 * 読んでいるあいだ。
 *
 * 画面には残り時間しか出さない。読むのは手元の本なので、
 * 画面に何かを置くほど本から目が離れる。
 */
function ReadingRun({ mode, title, onFinish }: ReadingRunProps) {
  const durationMs = PACED_READING.durationMs[mode]
  const countdown = useCountdown({ durationMs, onFinish })
  const { start } = countdown
  useEffect(() => start(), [start])

  // 1分に満たないうちは終われない。すぐ止めると、わずかな時間が分母に来て
  // 分速が跳ねる。あとで弾くより、そもそも作らせないほうがよい。
  const tooEarly = countdown.elapsedMs < PACED_READING.minElapsedMs

  return (
    <>
      <BtrTimerBar
        remainingMs={countdown.remainingMs}
        progress={countdown.progress}
        detail={READING_MODE_LABELS[mode]}
      />
      <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col items-center justify-center gap-6 px-5 pt-14 pb-6 sm:px-8">
        <p className="text-sm text-fg-muted">『{title}』</p>
        <p className="tabular text-6xl font-semibold">{formatRemaining(countdown.remainingMs)}</p>
        <p className="text-sm text-fg-muted">
          {mode === 'paced' ? '意識して速く読んでください' : 'いつもの読み方で読んでください'}
        </p>
        <Button
          variant="ghost"
          size="sm"
          disabled={tooEarly}
          onClick={() => countdown.finish()}
        >
          読み終えた・記録へ
        </Button>
        {tooEarly ? (
          <p className="text-xs text-fg-muted">
            記録に残すには {Math.round(PACED_READING.minElapsedMs / 1000)} 秒以上読んでください
          </p>
        ) : null}
      </main>
    </>
  )
}

/** 「8分12秒」の形。読んだ時間はページ数と並べて見るので、分と秒で出す。 */
function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return minutes === 0 ? `${seconds}秒` : `${minutes}分${seconds}秒`
}
