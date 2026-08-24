import { cn } from '@/lib/cn'

/**
 * 数字の並びを1本の線で見せる小さな図。
 *
 * 軸も目盛りも出さない。ここで知りたいのは「上がっているか下がっているか」だけで、
 * 個々の値は隣の数字を読めば分かる。軸を足すと、行に並べたときに図のほうが
 * 主役になってしまう。
 */

export interface SparklineProps {
  readonly values: readonly number[]
  /** 小さいほうがよい種目では上下を裏返す。 */
  readonly lowerIsBetter?: boolean
  readonly className?: string
  readonly label?: string
}

const WIDTH = 120
const HEIGHT = 28
const PAD = 3

export function Sparkline({
  values,
  lowerIsBetter = false,
  className,
  label,
}: SparklineProps) {
  // 2点なければ線にならない。
  if (values.length < 2) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min

  const points = values.map((value, index) => {
    const x = PAD + (index / (values.length - 1)) * (WIDTH - PAD * 2)
    // 値が全部同じときは真ん中に引く（0除算を避けるためでもある）。
    const ratio = span === 0 ? 0.5 : (value - min) / span
    const fromBottom = lowerIsBetter ? 1 - ratio : ratio
    const y = HEIGHT - PAD - fromBottom * (HEIGHT - PAD * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })

  const last = points[points.length - 1]!.split(',')

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
      height={HEIGHT}
      className={cn('overflow-visible', className)}
      role="img"
      aria-label={label ?? `直近 ${values.length} 回の推移`}
    >
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={last[0]} cy={last[1]} r={2.5} fill="currentColor" />
    </svg>
  )
}
