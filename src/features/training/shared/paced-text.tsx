'use client'

import { useMemo } from 'react'
import { chunkIndexAt, chunkOffsets } from '@/core/session/pacer'
import { cn } from '@/lib/cn'

export interface PacedTextProps {
  chunks: readonly string[]
  /** 現在の文字位置。ペーサーが進める。 */
  position: number
  serif?: boolean
}

/**
 * ペーサー付きの本文表示。
 * 現在位置のチャンクをハイライトし、まだ読んでいない部分を淡く落とす。
 * 視線を引っ張る役目だけを持たせ、装飾は加えない。
 */
export function PacedText({ chunks, position, serif = true }: PacedTextProps) {
  const offsets = useMemo(() => chunkOffsets(chunks), [chunks])
  const activeIndex = chunkIndexAt(offsets, position)

  return (
    <p className={cn('reading-body mx-auto', serif && 'reading-serif')}>
      {chunks.map((chunk, index) => (
        <span
          key={`${index}-${chunk}`}
          className={cn(
            'transition-colors duration-150',
            index === activeIndex && 'rounded bg-brand-soft text-brand',
            index > activeIndex && 'text-fg-subtle',
          )}
        >
          {chunk}
        </span>
      ))}
    </p>
  )
}
