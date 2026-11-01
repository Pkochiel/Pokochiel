import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const API_PORT = process.env.API_PORT ?? '8787';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/api': `http://localhost:${API_PORT}`,
      '/uploads': `http://localhost:${API_PORT}`,
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.mjs'],
  },
});
