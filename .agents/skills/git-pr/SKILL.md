---
name: git-pr
description: Opens a pull request for the current branch, with the body in the repository section format. Use when asked to raise a PR.
---

# Pull Request Creation

Create a PR following the Git conventions in `CLAUDE.md`.

## Current State

**Branch:**
Run `git branch --show-current` and use its output as context before continuing.

**Commits (vs main):**
Run `git log main..HEAD --oneline` and use its output as context before continuing.

**Remote status:**
Run `git status -sb` and use its output as context before continuing.

## PR Description

Write in English. Every section appears even when it has nothing, marked `- None`.

```markdown
## Features
## Bug Fixes
## Security
## Project Operations
## Risks
```

Entries read `- [Screen] what changed`, with the screen named for anything a user sees.
No summary section — the headings and their bullets are the summary.

Describe what the branch delivers, not the route it took there: a change reworked several
times appears once, in its final form. `## Risks` carries what the diff actually shows —
a new migration, an altered API contract, a change to how data is scoped, deleted tests —
and `None identified` when there is none. Do not pad it with generic caution.

## Output

Return the PR URL when complete.
