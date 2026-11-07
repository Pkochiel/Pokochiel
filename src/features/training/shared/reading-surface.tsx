import { cn } from '@/lib/cn'

export interface ReadingSurfaceProps {
  paragraphs: readonly { index: number; text: string }[]
  /** 明朝で組む（長文の通読向け） */
  serif?: boolean
  className?: string
}

/**
 * 本文表示。トレーニングの中核であり、可読性を最優先する。
 * 余計な装飾を置かず、行間・字送り・一行の長さだけを制御する。
 */
export function ReadingSurface({ paragraphs, serif = false, className }: ReadingSurfaceProps) {
  return (
    <div className={cn('reading-body mx-auto', serif && 'reading-serif', className)}>
      {paragraphs.map((paragraph) => (
        <p key={paragraph.index} className="mb-6 last:mb-0">
          {paragraph.text}
        </p>
      ))}
    </div>
  )
}
