/**
 * 読書時間の計測ロジック（純粋関数）。
 *
 * CPM の分母になる値なので、次を厳密に扱う。
 * - ポーズ中の時間は算入しない
 * - タブが非表示の間の時間も算入しない（放置による見かけ上の低速化を防ぐ）
 * - 時刻は必ず引数で受け取る（performance.now() は呼び出し側の責務）
 */

export type TimerStatus = 'idle' | 'running' | 'paused' | 'hidden' | 'finished'

export interface TimerState {
  status: TimerStatus
  /** 計測済みの累計ミリ秒（停止中の分は含まない） */
  accumulatedMs: number
  /** 現在の計測区間の開始時刻。停止中は null */
  runningSince: number | null
  /** ユーザーが明示的に一時停止した回数（非表示による自動停止は含まない） */
  pauseCount: number
  /** 非表示によって除外した回数 */
  hiddenCount: number
}

export const initialTimerState: TimerState = {
  status: 'idle',
  accumulatedMs: 0,
  runningSince: null,
  pauseCount: 0,
  hiddenCount: 0,
}

export type TimerEvent =
  | { type: 'start'; at: number }
  | { type: 'pause'; at: number }
  | { type: 'resume'; at: number }
  | { type: 'hide'; at: number }
  | { type: 'show'; at: number }
  | { type: 'finish'; at: number }

function stop(state: TimerState, at: number): number {
  return state.runningSince === null
    ? state.accumulatedMs
    : state.accumulatedMs + Math.max(0, at - state.runningSince)
}

export function timerReducer(state: TimerState, event: TimerEvent): TimerState {
  switch (event.type) {
    case 'start':
      if (state.status !== 'idle') return state
      return { ...state, status: 'running', runningSince: event.at }

    case 'pause':
      if (state.status !== 'running') return state
      return {
        ...state,
        status: 'paused',
        accumulatedMs: stop(state, event.at),
        runningSince: null,
        pauseCount: state.pauseCount + 1,
      }

    case 'hide':
      if (state.status !== 'running') return state
      return {
        ...state,
        status: 'hidden',
        accumulatedMs: stop(state, event.at),
        runningSince: null,
        hiddenCount: state.hiddenCount + 1,
      }

    case 'resume':
      if (state.status !== 'paused') return state
      return { ...state, status: 'running', runningSince: event.at }

    case 'show':
      // 非表示から戻ったときのみ自動再開する。ユーザーが止めた分は勝手に動かさない。
      if (state.status !== 'hidden') return state
      return { ...state, status: 'running', runningSince: event.at }

    case 'finish':
      if (state.status === 'idle' || state.status === 'finished') {
        return { ...state, status: 'finished', runningSince: null }
      }
      return {
        ...state,
        status: 'finished',
        accumulatedMs: stop(state, event.at),
        runningSince: null,
      }
  }
}

/** 現時点での経過ミリ秒。計測中なら現在時刻までを含める。 */
export function elapsedMs(state: TimerState, at: number): number {
  return stop(state, at)
}

export function elapsedSeconds(state: TimerState, at: number): number {
  return elapsedMs(state, at) / 1000
}
