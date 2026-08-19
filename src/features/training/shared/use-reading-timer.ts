'use client'

import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import {
  elapsedSeconds as computeElapsedSeconds,
  initialTimerState,
  timerReducer,
} from '@/core/session/timer'

/** 表示の更新間隔。計測自体は performance.now() で行うため、この値は精度に影響しない。 */
const DISPLAY_INTERVAL_MS = 200

export interface ReadingTimer {
  status: 'idle' | 'running' | 'paused' | 'hidden' | 'finished'
  /** 表示用の経過秒（小数）。計測値そのものは finish() の戻り値を使う。 */
  elapsedSeconds: number
  pauseCount: number
  start: () => void
  pause: () => void
  resume: () => void
  finish: () => { elapsedSeconds: number; pauseCount: number }
}

/**
 * 読書時間の計測。
 * 計測ロジックは core/session/timer の純粋関数に置き、ここは時刻の取得と
 * visibilitychange の購読だけを行う。
 */
export function useReadingTimer(): ReadingTimer {
  const [state, dispatch] = useReducer(timerReducer, initialTimerState)
  const [displaySeconds, setDisplaySeconds] = useState(0)
  const stateRef = useRef(state)

  // レンダー中に ref を書き換えない。dispatch のたびにこの effect が走るため、
  // ユーザー操作のハンドラが読む時点では常に最新の状態になっている。
  useEffect(() => {
    stateRef.current = state
  }, [state])

  const isTicking = state.status === 'running'

  useEffect(() => {
    if (!isTicking) return
    const id = window.setInterval(() => {
      setDisplaySeconds(computeElapsedSeconds(stateRef.current, performance.now()))
    }, DISPLAY_INTERVAL_MS)
    return () => window.clearInterval(id)
  }, [isTicking])

  // タブが隠れている間は計測を止める。これがないと CPM が容易に汚染される。
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
  const pause = useCallback(() => dispatch({ type: 'pause', at: performance.now() }), [])
  const resume = useCallback(() => dispatch({ type: 'resume', at: performance.now() }), [])

  const finish = useCallback(() => {
    const at = performance.now()
    const finished = timerReducer(stateRef.current, { type: 'finish', at })
    dispatch({ type: 'finish', at })
    const seconds = computeElapsedSeconds(finished, at)
    setDisplaySeconds(seconds)
    return { elapsedSeconds: seconds, pauseCount: finished.pauseCount }
  }, [])

  return {
    status: state.status,
    elapsedSeconds: state.status === 'idle' ? 0 : displaySeconds,
    pauseCount: state.pauseCount,
    start,
    pause,
    resume,
    finish,
  }
}
