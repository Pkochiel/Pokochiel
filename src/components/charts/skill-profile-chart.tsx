import { SKILL_IDS, SKILL_LABELS } from '@/core/types'
import type { SkillId, SkillProfile, SkillState } from '@/core/types'
import { SCORING } from '@/core/config/training-config'
import { cn } from '@/lib/cn'

export interface SkillProfileChartProps {
  profile: SkillProfile
  size?: number
}

const RINGS = [25, 50, 75, 100]

const STATE_LABELS: Record<SkillState, string> = {
  unmeasured: '未測定',
  weak: '弱い',
  normal: '標準',
  strong: '強い',
}

const STATE_CLASSES: Record<SkillState, string> = {
  unmeasured: 'text-fg-subtle',
  weak: 'text-negative',
  normal: 'text-fg-muted',
  strong: 'text-positive',
}

/**
 * 9軸のスキルチャート。
 *
 * 未測定の軸は中央値の位置に置きつつ、破線で「測っていない」ことを示す。
 * 0 に落とすと弱点と見分けがつかなくなるため。
 */
export function SkillProfileChart({ profile, size = 300 }: SkillProfileChartProps) {
  const center = size / 2
  const radius = center - 30
  const sidePadding = 78

  const axes = SKILL_IDS
  const valueOf = (id: SkillId) => profile[id].score ?? SCORING.neutralScore

  const pointAt = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / axes.length - Math.PI / 2
    const distance = (Math.min(100, Math.max(0, value)) / 100) * radius
    return { x: center + Math.cos(angle) * distance, y: center + Math.sin(angle) * distance }
  }

  const polygon = axes
    .map((id, i) => {
      const p = pointAt(i, valueOf(id))
      return `${p.x},${p.y}`
    })
    .join(' ')

  const measuredCount = axes.filter((id) => profile[id].state !== 'unmeasured').length

  return (
    <figure className="m-0">
      <svg
        viewBox={`${-sidePadding} 0 ${size + sidePadding * 2} ${size}`}
        className="mx-auto w-full"
        style={{ maxWidth: size + sidePadding * 2 }}
        role="img"
        aria-label="9つのスキルのバランス"
      >
        {RINGS.map((ring) => (
          <polygon
            key={ring}
            points={axes
              .map((_, i) => {
                const p = pointAt(i, ring)
                return `${p.x},${p.y}`
              })
              .join(' ')}
            fill="none"
            stroke="var(--chart-grid)"
            strokeWidth={1}
          />
        ))}

        {axes.map((id, i) => {
          const outer = pointAt(i, 100)
          return (
            <line
              key={id}
              x1={center}
              y1={center}
              x2={outer.x}
              y2={outer.y}
              stroke="var(--chart-grid)"
              strokeWidth={1}
            />
          )
        })}

        <polygon
          points={polygon}
          fill="var(--chart-1)"
          fillOpacity={0.1}
          stroke="var(--chart-1)"
          strokeWidth={2}
        />

        {axes.map((id, i) => {
          const p = pointAt(i, valueOf(id))
          const unmeasured = profile[id].state === 'unmeasured'
          return (
            <circle
              key={id}
              cx={p.x}
              cy={p.y}
              r={4}
              fill={unmeasured ? 'var(--surface)' : 'var(--chart-1)'}
              stroke="var(--chart-1)"
              strokeWidth={2}
            />
          )
        })}

        {axes.map((id, i) => {
          const label = pointAt(i, 122)
          const anchor = label.x > center + 6 ? 'start' : label.x < center - 6 ? 'end' : 'middle'
          return (
            <text
              key={id}
              x={label.x}
              y={label.y + 4}
              textAnchor={anchor}
              className="fill-[var(--fg-subtle)] text-[10px]"
            >
              {SKILL_LABELS[id]}
            </text>
          )
        })}
      </svg>

      <p className="mt-3 text-xs text-fg-subtle">
        {measuredCount} / {axes.length} のスキルを測定済みです。未測定の軸は中央値の位置に置いています。
      </p>

      <ul className="mt-3 space-y-1 text-xs">
        {axes.map((id) => {
          const measurement = profile[id]
          return (
            <li key={id} className="flex items-baseline justify-between gap-2">
              <span className="text-fg-muted">{SKILL_LABELS[id]}</span>
              <span className="flex items-baseline gap-2">
                <span className={cn('text-[10px]', STATE_CLASSES[measurement.state])}>
                  {STATE_LABELS[measurement.state]}
                </span>
                <span className="tabular w-8 text-right font-medium">
                  {measurement.score ?? '—'}
                </span>
              </span>
            </li>
          )
        })}
      </ul>
    </figure>
  )
}
