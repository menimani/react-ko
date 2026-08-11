import { execFile } from 'node:child_process'
import { mkdtemp, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import { expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const execFileAsync = promisify(execFile)

// esbuild runs in a child Node process rather than here: `bin/esbuild` is a
// native executable on Linux and macOS so it cannot be spawned through node,
// and esbuild's JS API refuses to start under this suite's jsdom environment.
async function bundleMinified(entryPoint: string, outfile: string) {
  const esbuildPath = require.resolve('esbuild')
  await execFileAsync(process.execPath, [
    '-e',
    `require(${JSON.stringify(esbuildPath)}).build({
      entryPoints: [${JSON.stringify(entryPoint)}],
      bundle: true,
      minify: true,
      format: 'esm',
      platform: 'browser',
      external: ['react'],
      outfile: ${JSON.stringify(outfile)},
    }).catch((error) => { console.error(error); process.exit(1) })`,
  ])
}

it('retires the built-in options binding from a minified consumer bundle', async () => {
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
  const outDir = await mkdtemp(join(packageRoot, '.minified-retirement-'))
  const outfile = join(outDir, 'minifiedOptionsRetirement.js')

  try {
    await bundleMinified(
      join(packageRoot, 'tests/fixtures/minifiedOptionsRetirement.ts'),
      outfile
    )

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
