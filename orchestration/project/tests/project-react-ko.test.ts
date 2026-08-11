import { describe, expect, it } from 'vitest'
import { reactKoProject } from '../project-react-ko.ts'

// The project adapter carries the repository's own knowledge: gate commands per
// TASK_GATE, which touched paths make each check relevant, and how a commit is
// presented in the generated pull request.

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

  it('runs the full suite by default and only builds under the light gate', () => {
    expect(check('Library gate', 'full').command).toBe('npm run test && npm run build')
    expect(check('Library gate', 'light').command).toBe('npm run build')
    expect(check('Library gate').installWhenMissing).toEqual({
      path: 'node_modules',
      command: 'npm ci --no-audit --no-fund',
    })
  })

  it('gates orchestration changes on the core suite and the adapter tests', () => {
    const orchestration = check('Orchestration gate')
    expect(orchestration.command).toBe(
      'npm ci --no-audit --no-fund && npm run typecheck && npm run test -- --pool=threads --poolOptions.threads.singleThread && npm run -C ../project test -- --pool=threads --poolOptions.threads.singleThread',
    )
    expect(orchestration.requires).toBe('orchestration/ts/package.json')
  })
})

describe('check selection', () => {
  it('treats everything outside orchestration and the hooks as the library', () => {
    expect(check('Library gate').appliesTo?.(['src/react-ko/src/index.ts'])).toBe(true)
    expect(check('Library gate').appliesTo?.(['README.md'])).toBe(true)
    expect(check('Library gate').appliesTo?.(['orchestration/ts/src/cli.ts'])).toBe(false)
    expect(check('Library gate').appliesTo?.(['.githooks/pre-commit'])).toBe(false)
    expect(check('Orchestration gate').appliesTo?.(['orchestration/ts/src/cli.ts'])).toBe(true)
  })
})

describe('cycle suite', () => {
  it('lists the suite and the build, with the vitest-launcher repair on the suite', () => {
    const steps = reactKoProject.cycleSuite()
    expect(steps.map((step) => step.label)).toEqual(['Library suite', 'Library build'])
    expect(steps[0]?.repairWhenMissing?.path).toBe('node_modules/.bin/vitest')
    expect(steps[0]?.repairWhenMissing?.command).toBe('npm install --no-audit --no-fund')
  })
})

describe('pull-request presentation', () => {
  const classify = (subject: string, files: string[]) =>
    reactKoProject.pullRequest.classifyCommit({ subject, files })

  it('sorts a peer-surface change into Compatibility ahead of its type prefix', () => {
    expect(classify('fix: React 19 ownership tests', ['src/react-ko/src/hooks/useKoValue.ts']))
      .toEqual({ category: 'Compatibility', area: 'Hooks' })
    expect(classify('feat: add a scope helper', ['src/react-ko/src/components/scope/x.ts']))
      .toEqual({ category: 'Compatibility', area: 'scope components' })
  })

  it('sorts tooling-only commits into Project Operations', () => {
    expect(classify('chore: retune the loop', ['orchestration/ts/src/loop.ts']))
      .toEqual({ category: 'Project Operations', area: 'Orchestration' })
  })

  it('falls back to the type prefix for ordinary library changes', () => {
    expect(classify('feat: add a structural component', ['src/react-ko/tests/x.test.tsx']))
      .toEqual({ category: 'Features', area: 'Tests' })
    expect(classify('fix: correct a message', ['src/react-ko/tests/y.test.tsx']))
      .toEqual({ category: 'Bug Fixes', area: 'Tests' })
  })

  it('names only risks the diff actually shows', () => {
    const risks = reactKoProject.pullRequest.detectRisks({
      files: ['src/react-ko/src/components/scope/bindingHandlerOwnership.ts'],
      deletedFiles: ['src/react-ko/tests/hooks/useKoValue.test.tsx'],
      diff: () => '',
    })
    expect(risks.some((risk) => risk.startsWith('Touches the React or Knockout'))).toBe(true)
    expect(risks.some((risk) => risk.startsWith('Changes Knockout binding-handler'))).toBe(true)
    expect(risks.some((risk) => risk.startsWith('Deletes test files'))).toBe(true)
    expect(risks.some((risk) => risk.startsWith('Changes a package manifest'))).toBe(false)
  })

  it('reports an export change only when the public entry points move', () => {
    const withExport = reactKoProject.pullRequest.detectRisks({
      files: ['src/react-ko/src/index.ts'],
      deletedFiles: [],
      diff: () => '-export { KoIf } from "./structural/KoIf"',
    })
    expect(withExport.some((risk) => risk.startsWith('Changes the exported API surface'))).toBe(true)

    const withoutExport = reactKoProject.pullRequest.detectRisks({
      files: ['src/react-ko/src/index.ts'],
      deletedFiles: [],
      diff: () => '-const internal = 1',
    })
    expect(withoutExport.some((risk) => risk.startsWith('Changes the exported API surface'))).toBe(false)
  })
})
