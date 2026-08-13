---
name: git-commit
description: Turns a dirty working tree into well-formed commits, splitting the changes when they serve more than one purpose. Use when asked to commit work that is already written, including edits made by hand.
---

# Committing existing work

Working tree:

Run `git status --short` and use its output as context before continuing.

Unstaged:

Run `git diff --stat` and use its output as context before continuing.

Staged:

Run `git diff --cached --stat` and use its output as context before continuing.

## Decide what belongs in the commit

The changes above were not necessarily written in one sitting or for one reason. Read
them before staging anything — `git diff` for what is unstaged, `git diff --cached` for
what is already staged.

Group them by purpose, not by file. If they serve one purpose, commit them together. If
they serve two, make two commits: stage the paths for the first, commit, then the rest.
Where a single file contains both, say so rather than splitting it silently — deciding
what ships together is the author's call.

Leave out anything that is not part of the work: stray debug output, an editor's
reformatting of untouched lines, a file that was only opened.

## Write the message

The prefix list and the one-purpose rule are in `CLAUDE.md`. What matters here is the
body: state why the change was made, not a prose restatement of the diff. A reader can
see what changed; they cannot see what it was for.

## Before committing

Run verification directly with the applicable repository commands unless it has already passed on this tree. A commit that fails the
build is worse than an uncommitted one, because it hides the failure behind a green
history.

The commit-msg hook rejects a subject without a recognised prefix, so a rejected commit
is a typo, not a reason to reword the change.
