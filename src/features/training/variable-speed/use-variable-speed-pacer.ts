'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { cpmForBand } from '@/core/training/variable-speed'
import type { SpeedBand } from '@/core/types'

export interface VariableSpeedSegmentInput {
  paragraphIndex: number
  text: string
}

export interface SegmentDwell {
  paragraphIndex: number
  /** 速度帯ごとの滞在時間（ms） */
  dwellByBand: Record<SpeedBand, number>
}

export interface VariableSpeedPacer {
  running: boolean
  segmentIndex: number
  /** 現在の区間の中で読み進んだ文字位置 */
  position: number
  /** 0–1 */
  segmentProgress: number
  band: SpeedBand
  setBand: (band: SpeedBand) => void
  start: () => void
  /** 現在の区間を読み終えたことにして次へ進む */
  skip: () => void
}

/**
 * 速度を切り替えられるペーサー。
 *
 * 位置を「経過時間 × 速度」で計算し直すと、速度変更のたびに位置が飛ぶ。
 * そのため毎フレームの差分を積分して位置を進める。
 * 速度帯ごとの滞在時間も同時に測り、あとで「どこで落とすべきだったか」を返せるようにする。
 */
export function useVariableSpeedPacer(options: {
  segments: readonly VariableSpeedSegmentInput[]
  targetCpm: number
  onSegmentComplete: (dwell: SegmentDwell, band: SpeedBand) => void
  onFinish: () => void
}): VariableSpeedPacer {
  const { segments, targetCpm } = options

  const [running, setRunning] = useState(false)
  const [segmentIndex, setSegmentIndex] = useState(0)
  const [position, setPosition] = useState(0)
  const [band, setBandState] = useState<SpeedBand>('normal')

  const bandRef = useRef<SpeedBand>('normal')
  const positionRef = useRef(0)
  const segmentRef = useRef(0)
  const dwellRef = useRef<Record<SpeedBand, number>>({ slow: 0, normal: 0, fast: 0 })
  const callbacksRef = useRef(options)

  // レンダー中に ref を書き換えない。イベント（rAF）から読む時点では更新済みになる。
  useEffect(() => {
    callbacksRef.current = options
  }, [options])

  const resetSegmentState = useCallback(() => {
    positionRef.current = 0
    setPosition(0)
    dwellRef.current = { slow: 0, normal: 0, fast: 0 }
  }, [])

  const completeSegment = useCallback(() => {
    const current = segments[segmentRef.current]
    if (current) {
      callbacksRef.current.onSegmentComplete(
        { paragraphIndex: current.paragraphIndex, dwellByBand: { ...dwellRef.current } },
        bandRef.current,
      )
    }
    const next = segmentRef.current + 1
    resetSegmentState()
    if (next >= segments.length) {
      setRunning(false)
      callbacksRef.current.onFinish()
      return
    }
    segmentRef.current = next
    setSegmentIndex(next)
  }, [resetSegmentState, segments])

  useEffect(() => {
    if (!running) return
    let frame = 0
    let last = performance.now()

    const tick = () => {
      const now = performance.now()
      const deltaMs = now - last
      last = now

      const currentBand = bandRef.current
      dwellRef.current[currentBand] += deltaMs

      const charsPerSecond = cpmForBand(targetCpm, currentBand) / 60
      positionRef.current += (charsPerSecond * deltaMs) / 1000
      setPosition(positionRef.current)

      const current = segments[segmentRef.current]
      if (current && positionRef.current >= current.text.length) {
        completeSegment()
        last = performance.now()
      }
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [running, targetCpm, segments, completeSegment])

  const setBand = useCallback((next: SpeedBand) => {
    bandRef.current = next
    setBandState(next)
  }, [])

  const start = useCallback(() => {
    segmentRef.current = 0
    setSegmentIndex(0)
    resetSegmentState()
    setRunning(true)
  }, [resetSegmentState])

  const skip = useCallback(() => {
    completeSegment()
  }, [completeSegment])

  const current = segments[segmentIndex]
  return {
    running,
    segmentIndex,
    position,
    segmentProgress: current ? Math.min(1, position / current.text.length) : 0,
    band,
    setBand,
    start,
    skip,
  }
}
