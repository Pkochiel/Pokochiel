'use client'

import { cn } from '@/lib/cn'

/**
 * 縦書きの一語。
 *
 * CSS の `writing-mode: vertical-rl` は使わない。フォントに縦組みの字形が
 * 入っていないと漢字だけが重なって潰れる。かなは正しく出るので、
 * 手元の見た目では気づけない（`text-orientation: upright` を足すと悪化する）。
 *
 * 1字ずつ block に置いて縦に積むほうが、どの環境でも同じに出る。
 */
export interface VerticalTextProps {
  readonly text: string
  readonly className?: string
}

export function VerticalText({ text, className }: VerticalTextProps) {
  return (
    <span className={cn('flex flex-col items-center leading-none', className)}>
      {[...text].map((char, index) => (
        <span key={`${index}-${char}`} className="block py-[0.15em]">
          {char}
        </span>
      ))}
    </span>
  )
}
