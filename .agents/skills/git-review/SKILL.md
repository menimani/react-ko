---
name: git-review
description: Reviews a pull request diff and submits the result as a GitHub review. Use when asked to review a PR, including one you opened yourself.
---

# Pull Request Review

Review PR code changes and submit approval or feedback.

## PR Context

**PR details:**
Run `gh pr view <pr-number> --json number,title,author,state,additions,deletions,changedFiles` and use its output as context before continuing.

**Current user:**
Run `gh api user --jq .login` and use its output as context before continuing.

**Changed files:**
Run `gh pr diff <pr-number> --name-only` and use its output as context before continuing.

## Self-PR Handling

GitHub does not allow self-approval. For self-PRs:
- Perform full review analysis
- Submit as **comment** (`gh pr review <number> --comment`) instead of approval
- Include "Verdict: APPROVED (self-review)" in comment

## Review Process

1. Read the full diff: `gh pr diff <number>`
2. Analyze each changed file for bugs, security issues, convention violations
3. Submit review with appropriate action (`--approve`, `--comment`, or `--request-changes`)

## Output

```
## Verification
- PR: #<number> reviewed
- files: [count] files analyzed
- result: [APPROVED/COMMENTED/CHANGES_REQUESTED]
- issues: [count] issues found (if any)
```
