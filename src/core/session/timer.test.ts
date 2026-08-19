import { describe, expect, it } from 'vitest'
import { elapsedSeconds, initialTimerState, timerReducer, type TimerEvent, type TimerState } from './timer'

function run(events: readonly TimerEvent[], from: TimerState = initialTimerState): TimerState {
  return events.reduce(timerReducer, from)
}

describe('timerReducer', () => {
  it('開始から終了までの経過を測る', () => {
    const state = run([
      { type: 'start', at: 1000 },
      { type: 'finish', at: 61_000 },
    ])
    expect(elapsedSeconds(state, 61_000)).toBe(60)
    expect(state.status).toBe('finished')
  })

  it('計測中は現在時刻までの経過を返す', () => {
    const state = run([{ type: 'start', at: 0 }])
    expect(elapsedSeconds(state, 5000)).toBe(5)
    expect(elapsedSeconds(state, 30_000)).toBe(30)
  })

  it('ポーズ中の時間を算入しない', () => {
    const state = run([
      { type: 'start', at: 0 },
      { type: 'pause', at: 10_000 },
      { type: 'resume', at: 40_000 },
      { type: 'finish', at: 50_000 },
    ])
    // 実時間 50 秒のうち、止めていた 30 秒を除いた 20 秒
    expect(elapsedSeconds(state, 50_000)).toBe(20)
    expect(state.pauseCount).toBe(1)
  })

  it('ポーズ中は時間が進まない', () => {
    const state = run([
      { type: 'start', at: 0 },
      { type: 'pause', at: 10_000 },
    ])
    expect(elapsedSeconds(state, 10_000)).toBe(10)
    expect(elapsedSeconds(state, 60_000)).toBe(10)
  })

  it('タブが非表示の間を算入しない', () => {
    const state = run([
      { type: 'start', at: 0 },
      { type: 'hide', at: 5000 },
      { type: 'show', at: 305_000 },
      { type: 'finish', at: 310_000 },
    ])
    // 5 分間放置しても、計測は 10 秒
    expect(elapsedSeconds(state, 310_000)).toBe(10)
    expect(state.hiddenCount).toBe(1)
    expect(state.pauseCount).toBe(0)
  })

  it('非表示からの復帰は自動再開するが、ユーザーのポーズは自動再開しない', () => {
    const paused = run([
      { type: 'start', at: 0 },
      { type: 'pause', at: 1000 },
      { type: 'show', at: 2000 },
    ])
    expect(paused.status).toBe('paused')

    const hidden = run([
      { type: 'start', at: 0 },
      { type: 'hide', at: 1000 },
      { type: 'show', at: 2000 },
    ])
    expect(hidden.status).toBe('running')
  })

  it('ポーズ中に非表示になっても二重に停止しない', () => {
    const state = run([
      { type: 'start', at: 0 },
      { type: 'pause', at: 10_000 },
      { type: 'hide', at: 20_000 },
      { type: 'resume', at: 30_000 },
      { type: 'finish', at: 40_000 },
    ])
    expect(elapsedSeconds(state, 40_000)).toBe(20)
    expect(state.hiddenCount).toBe(0)
  })

  it('開始前の finish は 0 秒として扱う', () => {
    const state = run([{ type: 'finish', at: 5000 }])
    expect(elapsedSeconds(state, 5000)).toBe(0)
    expect(state.status).toBe('finished')
  })

  it('二重の start を無視する', () => {
    const state = run([
      { type: 'start', at: 0 },
      { type: 'start', at: 10_000 },
    ])
    expect(elapsedSeconds(state, 20_000)).toBe(20)
  })

  it('終了後は時間が進まない', () => {
    const state = run([
      { type: 'start', at: 0 },
      { type: 'finish', at: 10_000 },
    ])
    expect(elapsedSeconds(state, 999_000)).toBe(10)
  })

  it('複数回のポーズを数える', () => {
    const state = run([
      { type: 'start', at: 0 },
      { type: 'pause', at: 1000 },
      { type: 'resume', at: 2000 },
      { type: 'pause', at: 3000 },
      { type: 'resume', at: 4000 },
      { type: 'finish', at: 5000 },
    ])
    expect(state.pauseCount).toBe(2)
    expect(elapsedSeconds(state, 5000)).toBe(3)
  })

  it('時刻が巻き戻っても負の経過にならない', () => {
    const state = run([
      { type: 'start', at: 10_000 },
      { type: 'finish', at: 5000 },
    ])
    expect(elapsedSeconds(state, 5000)).toBe(0)
  })
})
