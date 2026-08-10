import { configDefaults, defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      thresholds: {
        statements: 95,
        branches: 90,
        functions: 100,
        lines: 95,
      },
    },
    // The orchestration keeps its own vitest suite under orchestration/ts.
    exclude: [...configDefaults.exclude, 'orchestration/**'],
  },
  plugins: [tsconfigPaths()],
})
