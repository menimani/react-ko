---
name: verify-changes
description: Runs every check the repository has, choosing them from what the working tree touched, and reports each result. Use before committing, or when asked to verify the tree.
allowed-tools: Bash, Read
---

# Verifying changes

Changed paths:

!`git status --short`

## Choose by what changed

| Touched | Run | From |
|---------|-----|------|
| anything outside `orchestration/` and `.githooks/` | `npm run test`, `npm run build` | repository root |
| `orchestration/` | `npm run typecheck`, `npm run test` | `orchestration/ts` |
| `README.md` or `README.ja.md` | read both side by side and confirm they still say the same thing | — |
| anything | `node checks/english-only.ts` | repository root |

The language check is cheap and repository-wide, so it runs whatever changed. It knows
which paths are allowed to hold Japanese — the Japanese documentation, and the
`orchestration/ts` subtree this repository does not own.

The build is the type gate: tsup emits declarations, so a type error that the suite
never touches fails there. A suite pass without a build pass proves nothing about the
types the package will ship.

Run the checks that apply, not all of them: an orchestration-only change does not need
the library suite.

## Reading the results

Measure the exit code directly. `command | tail` reports the exit code of `tail`, so a
failing check reads as a pass — redirect to a file and check `$?` instead.

The library suite runs vitest under jsdom. A test that renders a `KnockoutScope` without
a `RootKnockoutProvider` above it is asserting on unbound DOM: it can pass while the
behaviour it claims to prove is broken, so treat a green run of such a test as no
evidence.

## Report

State each check and its result, then whether the tree is safe to commit. A check that
was skipped is reported as skipped, with the reason — never folded into a pass.
