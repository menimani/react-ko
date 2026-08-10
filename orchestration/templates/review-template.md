# {{REVIEW_ID}}

## Purpose

Review the diff this cycle produced and report what is wrong with it as NEXT_TASK.
**No code changes.** Each finding you report becomes a fix task the loop runs next.

## What you are reviewing

Scan cycle {{CYCLE}} of the autonomous loop. Pull request: {{PR_URL}}

```bash
git diff {{BASE_BRANCH}}...HEAD --stat
```
```bash
git log {{BASE_BRANCH}}..HEAD --oneline
```
```bash
git diff {{BASE_BRANCH}}...HEAD
```

Read the whole diff before judging any part of it. Where a hunk does not make sense on
its own, open the file around it — a diff hides the code it did not touch, and most wrong
changes look reasonable until you see what they sit next to.

## This is not a scan

A scan reads the repository to find work worth doing. You are reading what was already
done, for defects introduced by these commits. Something wrong with the codebase that
this diff neither caused nor claimed to fix is out of scope — the next scan will find it.

Report a finding only when you can name the commit or hunk responsible.

## Accepted limits

These are accepted limits by decision. Do not report them or narrower variants of them.
A finding qualitatively beyond an entry is still reportable.

{{ACCEPTED_LIMITS}}

## What to look for

Tests and the merge gate already passed on this diff, so anything they can catch is not
what you are here for. Look for what a green suite cannot see:

- **A change that passes its test but breaks a caller the test does not exercise.**
  Everything exported from `src/index.ts` has consumers this repository cannot see:
  follow each changed signature and prop shape as a published-API change, not a local
  refactor.
- **A test that was made to pass rather than made to hold.** A widened timeout, a
  weakened assertion, a mock that now returns whatever the implementation happens to
  produce, a deleted case. Check what each new or edited test would still catch.
- **A binding lifecycle that moved.** Registration shifted between effect and layout
  effect, a disposal dropped, a scope key left behind on unmount, a data-bind node that
  can now mount after the root has bound. Say which mount-order or unmount sequence
  breaks, not just that it might.
- **A behaviour the repository decided on deliberately, changed as though it were a
  bug.** `CLAUDE.md` names them: `data-bind` as the user-facing surface, the deprecated
  `*Comment` components kept until v2.0.0, zero runtime dependencies, React 18 and 19
  both supported. A diff that quietly crosses one is a finding even when the code works.
- **A claim in the READMEs that the diff made untrue** — and a change to one README
  whose translation twin was not changed to match.
- **A change that does more than one thing**: an API change, a refactor and a doc
  rewrite in one commit, or an unrelated cleanup bundled into a fix.
- **Anything left unfinished** — a placeholder body, an unresolved TODO, a file that
  builds only because nothing calls it yet.

Verify before reporting. Run the command, open the caller, read the README. A review
that reports a suspicion costs a fix task that finds nothing to fix.

## Output

Report **actual defects in this diff only**, one line each:

`NEXT_TASK: [category] specific description → fix approach`

The category is `BUG` / `API` / `FEATURE` / `TEST` / `DOCS`.

**Rules:**
- Write all NEXT_TASK and DECISION_REQUIRED findings in English
- Report only what you confirmed, naming the file and the commit or hunk it came from
- Write each one so the implementer needs nothing from you to fix it — file path, method
  name, what is wrong, and what correct looks like
- Up to 6 items, most serious first
- No code changes
- Do not output format examples or placeholders. Output only what you actually found.

If the diff is sound, print `NO_FINDINGS` on its own line and do not output any
`NEXT_TASK` lines. If a defect is found, output its `NEXT_TASK` line(s) and do not print
`NO_FINDINGS`.

## Completion marker

Finally print the following on its own line:
TASK_COMPLETE
