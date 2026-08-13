---
name: git-merge
description: Merges a pull request once CI and review allow it, then deletes the branch and returns to main. Use when asked to merge a PR.
---

# Pull Request Merge

Merge a PR following the Git conventions in `CLAUDE.md`.

## PR Context

**PR details:**
Run `gh pr view [pr-number] --json number,title,state,mergeable,reviewDecision,author,statusCheckRollup,reviews` and use its output as context before continuing.

**Current user:**
Run `gh api user --jq .login` and use its output as context before continuing.

## Pre-merge Checks

1. PR is open and mergeable
2. **Branch freshness**: CI tests the merge of the PR into main as main stood when CI
   ran, and main no longer re-runs the suites after the merge — so a PR behind main has
   green checks that describe a tree that will never exist. If main has advanced since
   the PR's checks ran, run `gh pr update-branch <number>`, wait for the re-run to go
   green, and only then merge. Branch protection enforces this; do not bypass it.
3. CI: all checks pass (`statusCheckRollup`; empty = no CI configured)
4. Review: see workflow below
5. No requested changes pending

## Merge Workflow

**Self-PR**: Require review comment via `$git-review` → merge (skip approval requirement)

**Others' PR**: Require at least one APPROVED review → **STOP** if none

## Policy

- Always use `--merge` (not `--squash`) when merging to main
- Delete branch after merge: `gh pr merge <number> --merge --delete-branch`
- Switch to main and pull: `git switch main && git pull --ff-only`

## Output

```
## Verification
- PR: #<number> merged
- reviews: [count] approved
- strategy: merge
- branch: <branch-name> deleted
- current: main (up to date)
```
