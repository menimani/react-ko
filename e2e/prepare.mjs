// Builds the TypeScript starter against a freshly packed react-ko tarball so
// the browser tests exercise exactly what npm would deliver.
import { execSync } from 'node:child_process'
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repo = join(here, '..')
const work = join(here, '.work')

rmSync(work, { recursive: true, force: true })
mkdirSync(work, { recursive: true })

execSync(`npm pack --pack-destination ${JSON.stringify(work)}`, {
  cwd: join(repo, 'src', 'react-ko'),
  stdio: 'inherit',
})
const tarball = readdirSync(work).find((name) => name.endsWith('.tgz'))
if (tarball === undefined) {
  throw new Error('npm pack produced no tarball')
}

const app = join(work, 'app')
cpSync(join(repo, 'starter', 'ts'), app, { recursive: true })

const manifestPath = join(app, 'package.json')
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
manifest.dependencies['react-ko'] = `file:../${tarball}`
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))

execSync('npm install --no-audit --no-fund', { cwd: app, stdio: 'inherit' })
execSync('npm run build', { cwd: app, stdio: 'inherit' })
