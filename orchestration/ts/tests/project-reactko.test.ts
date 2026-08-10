import { describe, expect, it } from 'vitest'
import { reactKoProject } from '../src/adapters/project-reactko.ts'

// The project adapter carries the repository's own knowledge: gate commands per
// TASK_GATE, and which touched paths make each check relevant.

function check(label: string, taskGate: 'full' | 'light' = 'full') {
  const found = reactKoProject.mergeChecks(taskGate).find((entry) => entry.label === label)
  if (found === undefined) throw new Error(`no such check: ${label}`)
  return found
}

describe('gate commands', () => {
  it('prepares runtime dependencies before a scan starts', () => {
    expect(reactKoProject.scanWorktreeSetup).toEqual([
      {
        label: 'Library dependencies',
        cwd: '',
        command: 'npm ci --no-audit --no-fund',
        requires: 'package-lock.json',
      },
      {
        label: 'Orchestration dependencies',
        cwd: 'orchestration/ts',
        command: 'npm ci --no-audit --no-fund',
        requires: 'orchestration/ts/package-lock.json',
      },
    ])
  })

  it('declares no production deployment', () => {
    expect(reactKoProject.deployment).toBeUndefined()
  })

  it('runs the suite and the build by default', () => {
    const library = check('Library gate', 'full')
    expect(library.command).toBe('npm run test && npm run build')
    expect(library.installWhenMissing).toEqual({
      path: 'node_modules',
      command: 'npm ci --no-audit --no-fund',
    })
  })

  it('only builds under the light gate', () => {
    expect(check('Library gate', 'light').command).toBe('npm run build')
  })
})

describe('check selection', () => {
  it('selects the library gate for everything outside the orchestration', () => {
    expect(check('Library gate').appliesTo?.(['src/components/structural/KoForeach.tsx'])).toBe(true)
    expect(check('Library gate').appliesTo?.(['README.md'])).toBe(true)
    expect(check('Library gate').appliesTo?.(['orchestration/ts/src/cli.ts'])).toBe(false)
    expect(check('Library gate').appliesTo?.(['.githooks/pre-commit'])).toBe(false)
  })

  it('gates orchestration changes on the TS suite', () => {
    const orchestration = check('Orchestration gate')
    expect(orchestration.appliesTo?.(['orchestration/ts/src/cli.ts'])).toBe(true)
    expect(orchestration.appliesTo?.(['src/index.ts'])).toBe(false)
    expect(orchestration.command).toBe(
      'npm ci --no-audit --no-fund && npm run typecheck && npm run test -- --pool=threads --poolOptions.threads.singleThread',
    )
    expect(orchestration.requires).toBe('orchestration/ts/package.json')
  })
})

describe('cycle suite', () => {
  it('lists suite and build with the vitest-launcher repair on the suite step', () => {
    const steps = reactKoProject.cycleSuite()
    expect(steps.map((step) => step.label)).toEqual(['Library suite', 'Library build'])
    const suite = steps[0]
    expect(suite?.repairWhenMissing?.path).toBe('node_modules/.bin/vitest')
    expect(suite?.repairWhenMissing?.command).toBe('npm install --no-audit --no-fund')
  })
})
