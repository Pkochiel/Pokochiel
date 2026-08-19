'use client'

import { useMemo } from 'react'
import { chunkIndexAt, chunkOffsets } from '@/core/session/pacer'
import { cn } from '@/lib/cn'

export interface PacedTextProps {
  /** 段落ごとの意味単位。段落構造を保ったまま表示する。 */
  paragraphs: readonly { index: number; chunks: readonly string[] }[]
  /** 現在の文字位置。ペーサーが進める。 */
  position: number
  serif?: boolean
}

/**
 * ペーサー付きの本文表示。
 * 現在位置のチャンクをハイライトし、まだ読んでいない部分を淡く落とす。
 * 視線を引っ張る役目だけを持たせ、装飾は加えない。
 */
export function PacedText({ paragraphs, position, serif = true }: PacedTextProps) {
  const flat = useMemo(() => paragraphs.flatMap((p) => p.chunks), [paragraphs])
  const offsets = useMemo(() => chunkOffsets(flat), [flat])
  const activeIndex = chunkIndexAt(offsets, position)

  // 段落ごとの開始インデックスを先に計算する（描画中に変数を書き換えない）
  const starts = useMemo(() => {
    const acc: number[] = []
    let total = 0
    for (const paragraph of paragraphs) {
      acc.push(total)
      total += paragraph.chunks.length
    }
    return acc
  }, [paragraphs])

  return (
    <div className={cn('reading-body mx-auto', serif && 'reading-serif')}>
      {paragraphs.map((paragraph, paragraphIndex) => {
        const start = starts[paragraphIndex] ?? 0
        return (
          <p key={paragraph.index} className="mb-6 last:mb-0">
            {paragraph.chunks.map((chunk, i) => {
              const index = start + i
              return (
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
              )
            })}
          </p>
        )
      })}
    </div>
  )
}
