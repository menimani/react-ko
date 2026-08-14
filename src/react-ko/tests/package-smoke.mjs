import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const expectedExports = [
  'KnockoutScope',
  'KoForeach',
  'useKoBind',
  'useKoValue',
  'useKoViewModel'
]

const esm = await import('react-ko')
const cjs = createRequire(import.meta.url)('react-ko')

assert.deepEqual(Object.keys(esm).sort(), expectedExports)
assert.deepEqual(Object.keys(cjs).sort(), expectedExports)

const packageDirectory = fileURLToPath(new URL('..', import.meta.url))
const npmCli = process.env.npm_execpath
assert.ok(npmCli, 'npm_execpath is required to inspect the package tarball')
const packResult = JSON.parse(
  execFileSync(process.execPath, [npmCli, 'pack', '--dry-run', '--json', '--ignore-scripts'], {
    cwd: packageDirectory,
    encoding: 'utf8'
  })
)
const packedFiles = new Set(packResult[0].files.map(({ path }) => path))

for (const file of ['README.md', 'README.ja.md', 'LICENSE']) {
  assert.ok(packedFiles.has(file), `${file} is missing from the npm package`)
  assert.equal(
    (await readFile(new URL(`../${file}`, import.meta.url), 'utf8')).replaceAll(
      '\r\n',
      '\n'
    ),
    (await readFile(new URL(`../../../${file}`, import.meta.url), 'utf8')).replaceAll(
      '\r\n',
      '\n'
    ),
    `${file} must stay synchronized with the repository copy`
  )
}
