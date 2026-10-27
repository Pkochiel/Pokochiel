'use client'

import { useId, useMemo, useState } from 'react'
import type { SeriesPoint } from '@/core/metrics/progress-series'
import { cn } from '@/lib/cn'

export interface ChartSeries {
  name: string
  points: readonly SeriesPoint[]
  /** 系列色。CSS 変数（--chart-1 / --chart-2）を渡す。 */
  color: string
}

export interface LineChartProps {
  series: readonly ChartSeries[]
  /** 値の単位（軸ラベルとツールチップに付ける） */
  unit?: string
  /** y 軸の下限を 0 に固定するか（割合系は true） */
  zeroBased?: boolean
  /** y 軸の上限を固定する（割合系は 100） */
  maxValue?: number
  height?: number
}

const VIEW_WIDTH = 720
const PADDING = { top: 16, right: 16, bottom: 28, left: 44 }
const MARK_RADIUS = 4

function niceTicks(min: number, max: number, count = 4): number[] {
  if (max <= min) return [min]
  const rawStep = (max - min) / count
  const magnitude = 10 ** Math.floor(Math.log10(rawStep))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= rawStep) ?? magnitude
  const start = Math.ceil(min / step) * step
  const ticks: number[] = []
  // 描画領域の外に出る目盛りは作らない（下端が切れて読めなくなるため）
  for (let v = start; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 100) / 100)
  return ticks.filter((t) => t >= min - 1e-9 && t <= max + 1e-9)
}

/**
 * 折れ線グラフ。
 *
 * - 系列は最大2本。2本のときは凡例を必ず出す（色だけに頼らせない）
 * - 実績のない日は線をつながず、点も描かない
 * - ホバーで縦線と値を出し、下部に表形式の内訳も置く（色が使えない場合の代替）
 */
export function LineChart({
  series,
  unit = '',
  zeroBased = false,
  maxValue,
  height = 200,
}: LineChartProps) {
  const titleId = useId()
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  const dates = series[0]?.points.map((p) => p.date) ?? []
  const values = series.flatMap((s) => s.points.flatMap((p) => (p.value === null ? [] : [p.value])))

  const { min, max, ticks } = useMemo(() => {
    if (values.length === 0) return { min: 0, max: 1, ticks: [0, 1] }
    const rawMax = maxValue ?? Math.max(...values)
    const rawMin = zeroBased ? 0 : Math.min(...values)
    const pad = (rawMax - rawMin) * 0.1 || 1
    const lo = zeroBased ? 0 : Math.max(0, rawMin - pad)
    const hi = maxValue ?? rawMax + pad
    return { min: lo, max: hi, ticks: niceTicks(lo, hi) }
  }, [values, zeroBased, maxValue])

  const plotWidth = VIEW_WIDTH - PADDING.left - PADDING.right
  const plotHeight = height - PADDING.top - PADDING.bottom

  const x = (index: number) =>
    PADDING.left + (dates.length <= 1 ? plotWidth / 2 : (index / (dates.length - 1)) * plotWidth)
  const y = (value: number) =>
    PADDING.top + plotHeight - ((value - min) / (max - min || 1)) * plotHeight

  const hasData = values.length > 0

  return (
    <figure className="m-0">
      {series.length > 1 ? (
        <figcaption className="mb-3 flex flex-wrap gap-4">
          {series.map((s) => (
            <span key={s.name} className="flex items-center gap-2 text-xs text-fg-muted">
              <span
                aria-hidden
                className="h-0.5 w-4 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              {s.name}
            </span>
          ))}
        </figcaption>
      ) : null}

      {!hasData ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border">
          <p className="px-6 text-center text-sm text-fg-subtle">
            この期間の実績はまだありません。
          </p>
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${VIEW_WIDTH} ${height}`}
          className="w-full"
          style={{ height }}
          role="img"
          aria-labelledby={titleId}
          onMouseLeave={() => setHoverIndex(null)}
        >
          <title id={titleId}>{series.map((s) => s.name).join(' と ')}の推移</title>

          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PADDING.left}
                x2={VIEW_WIDTH - PADDING.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke="var(--chart-grid)"
                strokeWidth={1}
              />
              <text
                x={PADDING.left - 8}
                y={y(tick) + 4}
                textAnchor="end"
                className="tabular fill-[var(--fg-subtle)] text-[11px]"
              >
                {tick.toLocaleString('ja-JP')}
              </text>
            </g>
          ))}

          {series.map((s) => {
            // 欠測をまたいで線をつながない
            const segments: { index: number; value: number }[][] = []
            let current: { index: number; value: number }[] = []
            s.points.forEach((point, index) => {
              if (point.value === null) {
                if (current.length > 0) segments.push(current)
                current = []
                return
              }
              current.push({ index, value: point.value })
            })
            if (current.length > 0) segments.push(current)

            return (
              <g key={s.name}>
                {segments.map((segment, i) => (
                  <polyline
                    key={i}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={segment.map((p) => `${x(p.index)},${y(p.value)}`).join(' ')}
                  />
                ))}
                {segments.flat().map((p) => (
                  <circle
                    key={`${p.index}`}
                    cx={x(p.index)}
                    cy={y(p.value)}
                    r={MARK_RADIUS}
                    fill={s.color}
                    stroke="var(--surface)"
                    strokeWidth={2}
                  />
                ))}
              </g>
            )
          })}

          {hoverIndex !== null ? (
            <line
              x1={x(hoverIndex)}
              x2={x(hoverIndex)}
              y1={PADDING.top}
              y2={PADDING.top + plotHeight}
              stroke="var(--fg-subtle)"
              strokeWidth={1}
            />
          ) : null}

          {dates.map((date, index) => (
            <rect
              key={date}
              x={x(index) - plotWidth / Math.max(1, dates.length - 1) / 2}
              y={PADDING.top}
              width={plotWidth / Math.max(1, dates.length - 1)}
              height={plotHeight}
              fill="transparent"
              onMouseEnter={() => setHoverIndex(index)}
            />
          ))}

          {dates.length > 0 ? (
            <>
              <text
                x={PADDING.left}
                y={height - 8}
                className="fill-[var(--fg-subtle)] text-[11px]"
              >
                {dates[0]?.slice(5)}
              </text>
              <text
                x={VIEW_WIDTH - PADDING.right}
                y={height - 8}
                textAnchor="end"
                className="fill-[var(--fg-subtle)] text-[11px]"
              >
                {dates[dates.length - 1]?.slice(5)}
              </text>
            </>
          ) : null}
        </svg>
      )}

      {hasData && hoverIndex !== null ? (
        <p className="mt-2 text-xs text-fg-muted">
          <span className="tabular">{dates[hoverIndex]}</span>
          {series.map((s) => {
            const value = s.points[hoverIndex]?.value
            return (
              <span key={s.name} className="ml-3">
                {s.name}:{' '}
                <span className="tabular font-medium text-fg">
                  {value === null || value === undefined ? '—' : `${value}${unit}`}
                </span>
              </span>
            )
          })}
        </p>
      ) : null}

      {hasData ? <DataTable series={series} unit={unit} /> : null}
    </figure>
  )
}

/** 色に頼らずに値を確認できる表。アクセシビリティ上の代替経路。 */
function DataTable({ series, unit }: { series: readonly ChartSeries[]; unit: string }) {
  const dates = series[0]?.points.map((p) => p.date) ?? []
  const rows = dates
    .map((date, index) => ({
      date,
      values: series.map((s) => s.points[index]?.value ?? null),
    }))
    .filter((row) => row.values.some((v) => v !== null))

  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-xs text-fg-subtle hover:text-fg-muted">
        数値で見る
      </summary>
      <table className="mt-2 w-full text-left text-xs">
        <thead className="text-fg-subtle">
          <tr>
            <th scope="col" className="py-1 font-medium">
              日付
            </th>
            {series.map((s) => (
              <th key={s.name} scope="col" className="py-1 font-medium">
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-fg-muted">
          {rows.map((row) => (
            <tr key={row.date} className="border-t border-border">
              <td className={cn('tabular py-1')}>{row.date}</td>
              {row.values.map((value, i) => (
                <td key={i} className="tabular py-1">
                  {value === null ? '—' : `${value}${unit}`}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}
