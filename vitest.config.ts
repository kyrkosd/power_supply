import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/engine/**']
    }
  },
  resolve: {
    alias: {
      '@engine': resolve(__dirname, 'src/engine'),
      '@data': resolve(__dirname, 'src/data')
    }
  }
})
