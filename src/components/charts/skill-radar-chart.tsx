import { SKILL_AXES, SKILL_AXIS_LABELS } from '@/core/metrics/skill-radar'
import type { SkillAxis, SkillRadar } from '@/core/types'

export interface SkillRadarChartProps {
  scores: SkillRadar
  /** 未実測の軸は淡く示し、実測値と区別する */
  measured?: Partial<Record<SkillAxis, boolean>>
  size?: number
}

const RINGS = [25, 50, 75, 100]

/**
 * 6軸のレーダーチャート。
 *
 * 系列は1つだけなので凡例は置かない。軸名を直接ラベルとして描き、
 * 数値は下の一覧で補う（未実測かどうかもそこで示す）。
 */
export function SkillRadarChart({ scores, measured = {}, size = 300 }: SkillRadarChartProps) {
  const center = size / 2
  const radius = center - 30
  /**
   * 軸ラベルは図形の外側に置くため、viewBox を左右に広げて逃がす。
   * 半径を縮めるより図が大きく保て、長いラベル（Adaptive Reading）も切れない。
   */
  const sidePadding = 64

  const pointAt = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / SKILL_AXES.length - Math.PI / 2
    const distance = (Math.min(100, Math.max(0, value)) / 100) * radius
    return { x: center + Math.cos(angle) * distance, y: center + Math.sin(angle) * distance }
  }

  const polygon = SKILL_AXES.map((axis, i) => {
    const p = pointAt(i, scores[axis])
    return `${p.x},${p.y}`
  }).join(' ')

  return (
    <figure className="m-0">
      <svg
        viewBox={`${-sidePadding} 0 ${size + sidePadding * 2} ${size}`}
        className="mx-auto w-full"
        style={{ maxWidth: size + sidePadding * 2 }}
        role="img"
        aria-label="6軸の能力バランス"
      >
        {RINGS.map((ring) => (
          <polygon
            key={ring}
            points={SKILL_AXES.map((_, i) => {
              const p = pointAt(i, ring)
              return `${p.x},${p.y}`
            }).join(' ')}
            fill="none"
            stroke="var(--chart-grid)"
            strokeWidth={1}
          />
        ))}

        {SKILL_AXES.map((axis, i) => {
          const outer = pointAt(i, 100)
          return (
            <line
              key={axis}
              x1={center}
              y1={center}
              x2={outer.x}
              y2={outer.y}
              stroke="var(--chart-grid)"
              strokeWidth={1}
            />
          )
        })}

        <polygon points={polygon} fill="var(--chart-1)" fillOpacity={0.1} stroke="var(--chart-1)" strokeWidth={2} />

        {SKILL_AXES.map((axis, i) => {
          const p = pointAt(i, scores[axis])
          return (
            <circle
              key={axis}
              cx={p.x}
              cy={p.y}
              r={4}
              fill="var(--chart-1)"
              stroke="var(--surface)"
              strokeWidth={2}
            />
          )
        })}

        {SKILL_AXES.map((axis, i) => {
          const label = pointAt(i, 118)
          const anchor = label.x > center + 6 ? 'start' : label.x < center - 6 ? 'end' : 'middle'
          return (
            <text
              key={axis}
              x={label.x}
              y={label.y + 4}
              textAnchor={anchor}
              className="fill-[var(--fg-subtle)] text-[10px]"
            >
              {SKILL_AXIS_LABELS[axis]}
            </text>
          )
        })}
      </svg>

      <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        {SKILL_AXES.map((axis) => (
          <li key={axis} className="flex items-baseline justify-between gap-2">
            <span className="text-fg-muted">{SKILL_AXIS_LABELS[axis]}</span>
            <span className="tabular font-medium">
              {scores[axis]}
              {measured[axis] === false ? (
                <span className="ml-1 text-[10px] font-normal text-fg-subtle">未測定</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  )
}
