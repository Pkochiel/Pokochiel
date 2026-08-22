'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/cn'

const ITEMS = [
  { href: '/dashboard', label: 'ホーム' },
  { href: '/btr', label: 'トレーニング' },
  { href: '/progress', label: '推移' },
  { href: '/settings', label: '設定' },
] as const

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** PC: 上部バー / スマホ: 下部タブバー。同じ項目を両方に出す。 */
export function AppNav() {
  const pathname = usePathname()

  return (
    <>
      <header className="sticky top-0 z-20 hidden border-b border-border bg-bg/85 backdrop-blur sm:block">
        <nav className="mx-auto flex max-w-5xl items-center gap-1 px-6 py-3">
          <Link href="/" className="mr-4 text-sm font-semibold tracking-tight">
            Speed Reading Lab
          </Link>
          {ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(pathname, item.href) ? 'page' : undefined}
              className={cn(
                'rounded-lg px-3 py-1.5 text-sm transition-colors',
                isActive(pathname, item.href)
                  ? 'bg-surface-muted font-medium text-fg'
                  : 'text-fg-muted hover:text-fg',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
        aria-label="メインナビゲーション"
      >
        <ul className="grid grid-cols-4">
          {ITEMS.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive(pathname, item.href) ? 'page' : undefined}
                className={cn(
                  'flex h-14 items-center justify-center text-xs transition-colors',
                  isActive(pathname, item.href) ? 'font-semibold text-brand' : 'text-fg-muted',
                )}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </>
  )
}
