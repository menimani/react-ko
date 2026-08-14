import type {
  MergeCheck,
  ProjectAdapter,
  PullRequestChanges,
  PullRequestClassification,
  PullRequestCommit,
  SuiteStep,
} from '../ts/src/adapters/project.ts'

// Everything outside orchestration/ and .githooks/ is the library: source, tests, docs,
// and the package manifests the build reads.
function isLibraryFile(file: string): boolean {
  return !file.startsWith('orchestration/') && !file.startsWith('.githooks/')
}

export const reactKoProject: ProjectAdapter = {
  name: 'react-ko',
  scanWorktreeSetup: [
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
  ],

  // What .githooks/pre-commit ran before the core owned it. The build is the type gate
  // here — tsup fails on a type error — and the suite stays in the merge gate, because a
  // commit that waits for it is a commit nobody makes.
  preCommitChecks: [
    {
      label: 'Library builds',
      cwd: '',
      command: 'npm run build',
      appliesTo: (changed) => changed.some(isLibraryFile),
      requires: 'package.json',
    },
    {
      label: 'Orchestration typechecks',
      cwd: 'orchestration/ts',
      command: 'npm run typecheck',
      appliesTo: (changed) => changed.some((file) => file.startsWith('orchestration/')),
      requires: 'orchestration/ts/package.json',
    },
  ],

  mergeChecks(taskGate: 'full' | 'light'): MergeCheck[] {
    return [
      {
        label: 'Library gate',
        cwd: '',
        command: taskGate === 'light' ? 'npm run build' : 'npm run test && npm run build',
        appliesTo: (changed) => changed.some(isLibraryFile),
        requires: 'package.json',
        installWhenMissing: {
          path: 'node_modules',
          command: 'npm ci --no-audit --no-fund',
        },
      },
      {
        // npm ci first: the gate runs in a fresh task worktree, which has the lockfile
        // but no node_modules — without the install every orchestration-touching merge
        // fails on missing tools, not on its diff.
        label: 'Orchestration gate',
        cwd: 'orchestration/ts',
        command: 'npm ci --no-audit --no-fund && npm run typecheck && npm run test -- --pool=threads --poolOptions.threads.singleThread && npm run -C ../project test -- --pool=threads --poolOptions.threads.singleThread',
        appliesTo: (changed) => changed.some((file) => file.startsWith('orchestration/')),
        requires: 'orchestration/ts/package.json',
      },
    ]
  },

  cycleSuite(): SuiteStep[] {
    return [
      {
        label: 'Library suite',
        cwd: '',
        command: 'npm run test',
        requires: 'package.json',
        // The vitest launcher shims in node_modules/.bin have vanished while the
        // package itself stayed installed, and the suite then reports the tree as
        // failing when only the environment is broken. Reinstalling is cheap against
        // an intact lockfile.
        repairWhenMissing: {
          path: 'node_modules/.bin/vitest',
          command: 'npm install --no-audit --no-fund',
          message: 'the vitest launcher is missing — running npm install to restore it',
        },
      },
      {
        label: 'Library build',
        cwd: '',
        command: 'npm run build',
        requires: 'package.json',
      },
      {
        label: 'Browser smoke',
        cwd: 'e2e',
        command: 'npx playwright install chromium && npm test',
        requires: 'e2e/package.json',
        repairWhenMissing: {
          path: 'e2e/node_modules/.bin/playwright',
          command: 'npm install --no-audit --no-fund',
          message: 'the Playwright launcher is missing — running npm install to restore it',
        },
      },
    ]
  },

  // Which paths mean "compatibility" and which mean "the scope internals" is knowledge
  // about this library, so it is held here rather than in the shared core.
  pullRequest: {
    categories: [
      { label: 'Features', title: { singular: 'feature', plural: 'features' } },
      { label: 'Bug Fixes', title: { singular: 'fix', plural: 'fixes' } },
      { label: 'Compatibility', title: { singular: 'compatibility fix', plural: 'compatibility fixes' } },
      { label: 'Project Operations' },
    ],
    titleFallback: 'tooling and documentation only',

    // Compatibility is decided first: a change that moves the React or Knockout peer
    // surface is what a consumer upgrades against, and the type prefix alone buries it
    // among ordinary fixes.
    classifyCommit({ subject, files }: PullRequestCommit): PullRequestClassification {
      const area = areaOfCommit(files)

      if (COMPATIBILITY_SUBJECTS.test(subject)
        || (files.some(isPackageManifest) && COMPATIBILITY_MANIFEST_SUBJECTS.test(subject))
        || files.some((file) => COMPATIBILITY_PATHS.test(file))) {
        return { category: 'Compatibility', area }
      }

      if (files.length > 0 && !files.some(isLibraryFile)) {
        return { category: 'Project Operations', area }
      }

      return { category: subject.startsWith('feat:') ? 'Features' : 'Bug Fixes', area }
    },

    // Only facts that can be detected from the diff.
    detectRisks({ files, deletedFiles, diff }: PullRequestChanges): string[] {
      const risks: string[] = []

      if (files.some(isPackageManifest)
        && changesConsumerResolution(diff(['package.json', 'src/react-ko/package.json']))) {
        risks.push('Changes package dependency or engine constraints; consumers may resolve a different supported environment')
      }
      if (files.some((file) => COMPATIBILITY_PATHS.test(file))) {
        risks.push('Touches the React or Knockout integration surface; re-check both supported React majors, not only the local one')
      }
      // A binding handler registered under a name a consumer also uses is the failure
      // this library exists to avoid, so a change to that registration is worth naming.
      if (files.some((file) => /bindingHandlerOwnership|descendantBindingBoundary/.test(file))) {
        risks.push('Changes Knockout binding-handler registration; a consumer handler sharing a name may now be rejected or adopted')
      }
      const publicApi = diff(['src/react-ko/src/index.ts', 'src/react-ko/src/**/index.ts'])
      if (/^[+-]\s*export /m.test(publicApi)) {
        risks.push('Changes the exported API surface; consumers importing the removed or renamed names will fail to build')
      }
      const deletedTests = deletedFiles.filter((file) => /test|Test/.test(file))
      if (deletedTests.length > 0) {
        risks.push(`Deletes test files, removing the verification they provided:\n${deletedTests
          .map((file) => `  - ${file}`).join('\n')}`)
      }

      return risks
    },
  },
}

const COMPATIBILITY_PATHS =
  /src\/react-ko\/src\/components\/scope\/|src\/react-ko\/src\/hooks\//
const COMPATIBILITY_SUBJECTS = /react 1[89]|knockout|peer|ssr|hydrat|ownership|binding/i
const COMPATIBILITY_MANIFEST_SUBJECTS = /\b(?:dependencies|engines?)\b/i
const CONSUMER_RESOLUTION_SECTIONS = new Set(['dependencies', 'engines', 'peerDependencies'])

function isPackageManifest(file: string): boolean {
  return file === 'package.json' || file === 'src/react-ko/package.json'
}

/** Whether a package-manifest patch changes a section consumers resolve against. */
function changesConsumerResolution(patch: string): boolean {
  let section: string | undefined

  for (const line of patch.split(/\r?\n/)) {
    if (line.startsWith('diff --git ') || line.startsWith('@@')) {
      section = undefined
      continue
    }

    const prefix = line[0]
    if (prefix !== ' ' && prefix !== '+' && prefix !== '-') continue
    if (line.startsWith('+++') || line.startsWith('---')) continue

    const topLevelProperty = /^  "([^"]+)":/.exec(line.slice(1))
    if (topLevelProperty !== null) {
      section = topLevelProperty[1]
      if (prefix !== ' ' && CONSUMER_RESOLUTION_SECTIONS.has(section)) return true
      continue
    }

    if (prefix !== ' ' && section !== undefined
      && CONSUMER_RESOLUTION_SECTIONS.has(section)) return true
  }

  return false
}

/** Estimate which part of the library a commit changed from the files it touched. */
function areaOfCommit(files: readonly string[]): string {
  for (const file of files) {
    const component = /src\/react-ko\/src\/components\/([a-z]+)\//.exec(file)
    if (component !== null) return `${component[1]} components`
  }
  if (files.some((file) => file.startsWith('src/react-ko/src/hooks/'))) return 'Hooks'
  if (files.some((file) => file.startsWith('src/react-ko/src/context/'))) return 'Context'
  if (files.some((file) => file.startsWith('src/react-ko/tests/'))) return 'Tests'
  if (files.some((file) => file.startsWith('e2e/'))) return 'Browser smoke'
  if (files.some((file) => file.startsWith('orchestration/'))) return 'Orchestration'
  if (files.some((file) => file.startsWith('.github/'))) return 'CI'
  return 'Other'
}
