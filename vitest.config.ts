import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    globals: true,
    // 既定は node。DOM が必要なテストはファイル先頭に
    // `// @vitest-environment jsdom` を書く。
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
