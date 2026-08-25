import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

function packageDirectory(runtime: string, name: string) {
  const fixture = fileURLToPath(
    new URL(`../../test-runtimes/${runtime}/package.json`, import.meta.url)
  )
  const runtimeRequire = createRequire(fixture)
  return dirname(runtimeRequire.resolve(`${name}/package.json`)).replaceAll('\\', '/')
}

export default defineConfig(({ mode }) => {
  if (mode !== 'react18' && mode !== 'react19') {
    throw new Error(`Expected React runtime mode, received ${mode}`)
  }

  const react = packageDirectory(mode, 'react')
  const reactDom = packageDirectory(mode, 'react-dom')
  const testingLibrary = packageDirectory(mode, '@testing-library/react')

  return {
    resolve: {
      alias: [
        { find: /^react$/, replacement: join(react, 'index.js') },
        { find: /^react\/(.+)$/, replacement: `${react}/$1` },
        { find: /^react-dom$/, replacement: join(reactDom, 'index.js') },
        { find: /^react-dom\/(.+)$/, replacement: `${reactDom}/$1` },
        {
          find: /^@testing-library\/react$/,
          replacement: join(testingLibrary, 'dist', 'index.js'),
        },
      ],
    },
    test: {
      globals: true,
      environment: 'jsdom',
      include: [
        'tests/components/scope/**/*.test.{ts,tsx}',
        'tests/components/structural/restrictedParent.test.tsx',
        'tests/hooks/useKoBind.test.tsx',
      ],
    },
    plugins: [tsconfigPaths()],
  }
})
