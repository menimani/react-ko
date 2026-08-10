import type { MergeCheck, ProjectAdapter, SuiteStep } from './project.ts'

// What this repository's checks are and when they apply. react-ko is a single npm
// package in the src/react-ko workspace, and the root package.json proxies test
// and build into it, so every command here still runs at the repository root:
// vitest is the suite and tsup the build, and the build is also the type gate,
// because tsup emits declarations and there is no separate lint script. The
// full/light distinction: "full" runs suite and build on every task merge;
// "light" proves the tree builds, and leaves the suite to the cycle gate so a
// cycle pays for it once instead of once per task.

export const reactKoProject: ProjectAdapter = {
  name: 'react-ko',
  scanWorktreeSetup: [
    {
      label: 'Library dependencies',
      cwd: '',
      command: 'npm ci --no-audit --no-fund',
      requires: 'package-lock.json',
    },
  ],

  mergeChecks(taskGate: 'full' | 'light'): MergeCheck[] {
    return [
      {
        label: 'Library gate',
        cwd: '',
        command: taskGate === 'light' ? 'npm run build' : 'npm run test && npm run build',
        // Everything outside orchestration/ and .githooks/ is the library: source,
        // tests, docs, and the package manifests the build reads.
        appliesTo: (changed) =>
          changed.some((file) => !file.startsWith('orchestration/') && !file.startsWith('.githooks/')),
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
        command: 'npm ci --no-audit --no-fund && npm run typecheck && npm run test -- --pool=threads --poolOptions.threads.singleThread',
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
    ]
  },
}
