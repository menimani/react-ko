import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      thresholds: {
        statements: 90,
        branches: 83,
        functions: 92,
        lines: 90,
      },
    },
  },
  plugins: [tsconfigPaths()],
})
