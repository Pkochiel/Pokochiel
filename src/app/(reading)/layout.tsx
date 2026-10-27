/**
 * Reading Mode のシェル。
 * ナビゲーション等を一切表示しない（distraction-free）。
 */
export default function ReadingLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-reading-bg text-reading-fg">{children}</div>
}
