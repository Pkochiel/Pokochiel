import type { Metadata, Viewport } from 'next'
import { ServiceWorkerRegistrar } from '@/features/shell/service-worker-registrar'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Speed Reading Lab',
    template: '%s · Speed Reading Lab',
  },
  description:
    '速く理解し、必要な情報を選び、後から思い出せる能力を鍛える日本語速読トレーニング。',
  applicationName: 'Speed Reading Lab',
  appleWebApp: { capable: true, title: 'SR Lab', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbfbfd' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0e16' },
  ],
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  )
}
