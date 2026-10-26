/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const API_TARGET = process.env.VITE_DEV_API_TARGET ?? 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': { target: API_TARGET, changeOrigin: true } },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) =>
          id.includes('node_modules/recharts') || id.includes('node_modules/d3') ? 'charts' : undefined,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/main.tsx', 'src/test/**', 'src/**/*.test.{ts,tsx}'],
      thresholds: { lines: 80, statements: 80, functions: 70, branches: 70 },
    },
  },
})
