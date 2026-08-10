import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import knockout from 'knockout'

const expectedExports = [
  'AppViewModelContext',
  'KnockoutScope',
  'KoForeach',
  'KoIf',
  'KoIfNot',
  'KoScope',
  'KoWith',
  'RootKnockoutProvider',
  'useAppViewModel',
  'useKoValue'
]

const esm = await import('react-ko')
const cjs = createRequire(import.meta.url)('react-ko')

assert.deepEqual(Object.keys(esm).sort(), expectedExports)
assert.deepEqual(Object.keys(cjs).sort(), expectedExports)
assert.equal(esm.KoScope, esm.KnockoutScope)
assert.equal(cjs.KoScope, cjs.KnockoutScope)
assert.equal(typeof knockout.bindingHandlers.reactKoScopeBoundary?.init, 'function')
