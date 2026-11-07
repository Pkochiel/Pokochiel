'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * 制限時間つきの種目のためのカウントダウン。
 *
 * BTRメソッドの種目はどれも「決まった時間でどこまでできるか」を測る。
 * 残り時間の表示と、時間切れの通知だけを受け持つ。
 *
 * 経過は performance.now() の差で測る。setInterval の回数を数えると、
 * タブが背面に回ったときに間引かれて実際より短く出てしまう。
 */

/** 表示の更新間隔。残り時間は毎フレーム測り直すので、精度には影響しない。 */
const TICK_MS = 100

export interface Countdown {
  readonly running: boolean
  readonly finished: boolean
  /** 残り（ms）。0 未満にはならない。 */
  readonly remainingMs: number
  /** 経過（ms） */
  readonly elapsedMs: number
  /** 0–1 */
  readonly progress: number
  start: () => void
  /** 時間を待たずに終える（全部拾い終えたときなど）。 */
  finish: () => void
}

export interface UseCountdownOptions {
  readonly durationMs: number
  /** 時間切れ、または finish() で終わったときに一度だけ呼ばれる。 */
  readonly onFinish?: (elapsedMs: number) => void
}

export function useCountdown({ durationMs, onFinish }: UseCountdownOptions): Countdown {
  const [running, setRunning] = useState(false)
  const [finished, setFinished] = useState(false)
  const [elapsedMs, setElapsedMs] = useState(0)

  const startedAt = useRef<number | null>(null)
  // 終了時の副作用は一度だけ。時間切れと finish() が重なっても二重に呼ばない。
  const settled = useRef(false)
  const onFinishRef = useRef(onFinish)
  // 描画中に ref を書き換えない。差し替えは効果の中で行う。
  useEffect(() => {
    onFinishRef.current = onFinish
  }, [onFinish])

  const settle = useCallback((at: number) => {
    if (settled.current) return
    settled.current = true
    setRunning(false)
    setFinished(true)
    setElapsedMs(at)
    onFinishRef.current?.(at)
  }, [])

  const start = useCallback(() => {
    if (settled.current) return
    startedAt.current = performance.now()
    setElapsedMs(0)
    setRunning(true)
  }, [])

  const finish = useCallback(() => {
    const began = startedAt.current
    settle(began === null ? 0 : performance.now() - began)
  }, [settle])

  useEffect(() => {
    if (!running) return
    const timer = window.setInterval(() => {
      const began = startedAt.current
      if (began === null) return
      const elapsed = performance.now() - began
      if (elapsed >= durationMs) settle(durationMs)
      else setElapsedMs(elapsed)
    }, TICK_MS)
    return () => window.clearInterval(timer)
  }, [durationMs, running, settle])

  return {
    running,
    finished,
    remainingMs: Math.max(0, durationMs - elapsedMs),
    elapsedMs,
    progress: durationMs <= 0 ? 0 : Math.min(1, elapsedMs / durationMs),
    start,
    finish,
  }
}

/** 残り時間の表示。「1:30」の形。 */
export function formatRemaining(remainingMs: number): string {
  const total = Math.ceil(remainingMs / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}
