'use client'

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import {
  elapsedSeconds as computeElapsedSeconds,
  initialTimerState,
  timerReducer,
} from '@/core/session/timer'
import { charPositionAt, pacerProgress } from '@/core/session/pacer'

export interface Pacer {
  status: 'idle' | 'running' | 'paused' | 'hidden' | 'finished'
  /** 現在読み進んでいるはずの文字位置 */
  position: number
  /** 読み戻した回数 */
  backCount: number
  /** 0–1 */
  progress: number
  elapsedSeconds: number
  pauseCount: number
  start: () => void
  toggle: () => void
  /** 読み戻す（禁止はしない。回数だけ記録する）。 */
  goBack: (chars: number) => void
  finish: () => { elapsedSeconds: number; pauseCount: number; backCount: number }
}

export interface UsePacerOptions {
  targetCpm: number
  totalCharacters: number
  /**
   * 本文の末尾に到達したときに一度だけ呼ばれる。
   * 到達＝読了なので、計測はここで確定して渡す。
   */
  onReachEnd?: (result: {
    elapsedSeconds: number
    pauseCount: number
    backCount: number
  }) => void
}

/**
 * ペーサー。目標速度に沿って読み位置を進める。
 *
 * 進行は requestAnimationFrame で行う（setInterval はドリフトするため）。
 * 位置の計算そのものは core/session/pacer の純粋関数に置く。
 */
export function usePacer({ targetCpm, totalCharacters, onReachEnd }: UsePacerOptions): Pacer {
  const [state, dispatch] = useReducer(timerReducer, initialTimerState)
  const [live, setLive] = useState({ position: 0, elapsedSeconds: 0 })
  // 読み戻しは位置の補正として扱う（時間は巻き戻さない）
  const [offsetChars, setOffsetChars] = useState(0)
  const [backCount, setBackCount] = useState(0)
  const offsetRef = useRef(0)
  const stateRef = useRef(state)
  const reachedEndRef = useRef(false)
  const backCountRef = useRef(0)
  const onReachEndRef = useRef(onReachEnd)

  useEffect(() => {
    stateRef.current = state
  }, [state])

  useEffect(() => {
    onReachEndRef.current = onReachEnd
  }, [onReachEnd])

  useEffect(() => {
    offsetRef.current = offsetChars
  }, [offsetChars])

  useEffect(() => {
    backCountRef.current = backCount
  }, [backCount])

  const running = state.status === 'running'

  useEffect(() => {
    if (!running) return
    let frame = 0
    const tick = () => {
      const seconds = computeElapsedSeconds(stateRef.current, performance.now())
      const position = Math.max(0, charPositionAt(seconds, targetCpm) + offsetRef.current)
      setLive({ position, elapsedSeconds: seconds })

      // 末尾への到達は effect ではなくここで検出する（描画中に状態を変えない）
      if (!reachedEndRef.current && totalCharacters > 0 && position >= totalCharacters) {
        reachedEndRef.current = true
        const at = performance.now()
        const finished = timerReducer(stateRef.current, { type: 'finish', at })
        dispatch({ type: 'finish', at })
        onReachEndRef.current?.({
          elapsedSeconds: computeElapsedSeconds(finished, at),
          pauseCount: finished.pauseCount,
          backCount: backCountRef.current,
        })
        return
      }
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [running, targetCpm, totalCharacters])

  // タブが隠れている間はペーサーを止める。戻ったときに置いていかれないようにする。
  useEffect(() => {
    const onVisibilityChange = () => {
      dispatch({
        type: document.visibilityState === 'hidden' ? 'hide' : 'show',
        at: performance.now(),
      })
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [])

  const start = useCallback(() => dispatch({ type: 'start', at: performance.now() }), [])

  const goBack = useCallback((chars: number) => {
    setOffsetChars((current) => current - Math.abs(chars))
    setBackCount((count) => count + 1)
  }, [])

  const toggle = useCallback(() => {
    const at = performance.now()
    dispatch({ type: stateRef.current.status === 'running' ? 'pause' : 'resume', at })
  }, [])

  const finish = useCallback(() => {
    const at = performance.now()
    const finished = timerReducer(stateRef.current, { type: 'finish', at })
    dispatch({ type: 'finish', at })
    return {
      elapsedSeconds: computeElapsedSeconds(finished, at),
      pauseCount: finished.pauseCount,
      backCount: backCountRef.current,
    }
  }, [])

  // 停止中は蓄積値がそのまま経過時間になるため、レンダー中に時刻を読まない。
  const elapsedSeconds = running ? live.elapsedSeconds : state.accumulatedMs / 1000

  return {
    status: state.status,
    position: live.position,
    progress: pacerProgress(live.position, totalCharacters),
    elapsedSeconds,
    pauseCount: state.pauseCount,
    backCount,
    start,
    toggle,
    goBack,
    finish,
  }
}
