import { AppNav } from '@/features/shell/app-nav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <AppNav />
      {/* 下部タブバーの高さぶん余白を確保する（スマホのみ） */}
      <main className="mx-auto max-w-5xl px-5 pt-6 pb-24 sm:px-6 sm:pb-12">{children}</main>
    </div>
  )
}
