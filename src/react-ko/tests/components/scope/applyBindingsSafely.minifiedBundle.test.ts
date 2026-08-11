import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const tsupRequire = createRequire(require.resolve('tsup/package.json'))
const execFileAsync = promisify(execFile)

it('retires the built-in options binding from a minified consumer bundle', async () => {
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
  const outDir = await mkdtemp(join(packageRoot, '.minified-retirement-'))
  const outfile = join(outDir, 'minifiedOptionsRetirement.js')

  try {
    const esbuild = join(
      dirname(tsupRequire.resolve('esbuild/package.json')),
      'bin/esbuild'
    )
    await execFileAsync(process.execPath, [
      esbuild,
      join(packageRoot, 'tests/fixtures/minifiedOptionsRetirement.ts'),
      '--bundle',
      '--minify',
      '--format=esm',
      '--platform=browser',
      '--external:react',
      `--outfile=${outfile}`,
    ])

    const bundle = await import(pathToFileURL(outfile).href) as {
      retireOptionsBinding(): {
        boundOptionCount: number
        retiredOptionCount: number
        error: unknown
      }
    }

    expect(bundle.retireOptionsBinding()).toEqual({
      boundOptionCount: 2,
      retiredOptionCount: 0,
      error: undefined,
    })
  } finally {
    await rm(outDir, { recursive: true, force: true })
  }
}, 30_000)
