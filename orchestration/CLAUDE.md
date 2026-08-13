# Orchestration

Claude Code designs and merges the work; a runner (Codex by default) executes it in a
dedicated git worktree. The command surface is the `scripts` block of
`orchestration/ts/package.json` — `npm run -C orchestration/ts <command>`, and
`npm run -C orchestration/ts` lists the available commands. Environment
variables pass through npm unchanged, so settings go in front of the command as they
always did.

This file holds what the source cannot tell you: when delegating is worth it, and the
behaviour that catches people out. The behavior checklist is `orchestration/ts/SPEC.md`,
and the vitest suite under `orchestration/ts/tests/` is what keeps it honest.

It needs Node 23.6 or later (the TypeScript sources are executed natively, with no build
step) and the `codex` CLI, already authenticated. Forge access (`gh`), the runner CLI,
and the repository's own test commands are reached only through the adapters: forge and
runner ship with the core in `orchestration/ts/src/adapters/`, and the project adapter —
this repository's own gates, suites, and pull-request presentation — is
`orchestration/project/project-react-ko.ts`, discovered by name at startup. Add an
adapter to port to another forge, agent CLI, or repository; never hardcode any of the
three in the core. Each task gets its own worktree under `orchestration/worktrees/` on a
`task/<id>` branch.

`orchestration/ts/` is a `git subtree` of
[orchestration-core](https://github.com/menimani/orchestration-core), not a copy to edit
here. A change made in it would be overwritten by the next pull and would never reach the
other repositories using the same engine: make it upstream and pull it down. The loop does
that pull itself before each cycle unless `CORE_AUTO_UPDATE=false`.

`ISSUE_QUEUE_ENABLED=true` moves the backlog to forge issues: findings are filed once
per fingerprint under `loop:ready`, worker daemons claim by self-assigning, quiet leases
are reaped after `ISSUE_LEASE_HOURS`, and the merge commit's `closes #N` closes the issue
when the promotion PR lands. The forge login is the worker identity, so concurrently
claiming daemons must authenticate as distinct forge accounts. With that invariant,
simultaneous claims settle by choosing the lexicographically first login; daemons sharing
an account are indistinguishable and may both materialize the issue. The delegate CLI
only publishes ready work, so it can safely share the daemon's login.
This is the shared-backlog layer for running several workers against one repository;
the single serial merger and the local queue semantics are unchanged, and it is off by
default until the parity validation run has shipped.

Run a second machine as an execution-only worker with
`npm run -C orchestration/ts worker -- <base-ref>`, where the base ref is normally the
merger's run branch or `origin/main`. The command fetches and safely fast-forwards the
checkout when needed, verifies worker-mode support, and supplies the required environment.
Worker mode claims and executes shared issues, pushes completed task branches, and never
scans, reviews, opens pull requests, or merges. Keep exactly one normal daemon as the
merger that owns the run tree and adopts those remote branches.

A task reads `running` while its Codex process is alive, `completed` once `TASK_COMPLETE`
appears on its own line in the task's `.final` file, and `failed` when the process is gone
without that marker there. Codex writes this authoritative final-message file through
`--output-last-message`; markers in the full transcript log are ignored. A task that did
the work but omitted the marker from its final message is therefore indistinguishable from
one that crashed.

## Delegate only what can run unattended

A task is worth handing to Codex when all three hold: it does not depend on another
task's output, it can be specified precisely enough that no question needs answering
midway, and it is larger than the cost of writing that specification and watching the
result. A few lines in one file, or anything that has to be settled interactively, is
faster done directly.

A specification that leaves a judgement call open will have it made for you, and rarely
the way you meant. Name the files, state the requirement so an implementer needs no
context you did not give, and make the completion condition something that can be run —
a test name, a command.

## Two things every task must do

Both have been missed repeatedly, and each one loses work:

- **Commit.** Merging reads commits, not the working tree.
- **Print `TASK_COMPLETE`** on its own line at the end of the final message. Completion is
  detected only from the `.final` file written by `--output-last-message`, not from the
  transcript; without the marker there, finished work is recorded as failed.

Call `merge` with `--yes` from a non-interactive session. It prompts otherwise, and waits
for an answer nobody is there to give.

## What the loop does on its own

Given a queue, the loop starts tasks up to the parallel limit, merges what completes, and
grows: a task that prints `NEXT_TASK: <description>` in its final response before the
completion marker has that description turned into a queued task. Depth and total limits
keep this from running away. Directives in the working transcript are ignored.

When the queue empties and nothing is running, a scan task inspects the repository and
reports what it finds the same way — bugs, public-API problems, absent capabilities,
tests worth adding or deleting, claims in the READMEs the source contradicts, the two
READMEs drifting apart, and open Dependabot advisories.

Not every finding may become work. A `DECISION_REQUIRED: <text>` line is reported rather
than queued: it is logged, carried into the pull request's risks, and left for a person.
Major version upgrades go this way — an agent that performs one has accepted its breaking
changes on the user's behalf, which is not a call it gets to make. Advisories fixed inside
the current major version stay ordinary `NEXT_TASK` work.

A decision naming a `GHSA-` or `CVE-` identifier is matched on that identifier, because a
scan writes prose and words the same advisory differently every cycle — one react-router
alert reached the same pull request three times before this. One naming neither is matched
on the whole line, so a design choice reworded still comes back twice.

Scanning ends at the cycle limit, or earlier once scans stop finding anything.

Before merging, tests are chosen from the paths the worktree touched. A merge aborts and
keeps the worktree when it holds uncommitted changes or no new commits, so an agent that
forgets to commit does not silently lose its work. Scan tasks are exempt from the commit
check, because investigating produces none.

Each cycle ends at a gate: push, and open or update a draft pull request. The final cycle
passes the same gate before the pull request is promoted and `LOOP_DONE` printed —
promotion is what puts CI on it.

**The gate does not wait for CI.** CI runs where a merge is decided, on a pull request
ready for review and on main, so a draft pull request has no checks to wait for and a gate
that polled for them would hang. What the cycle rests on instead is the merges: every task
ran the full suite against this branch's tip before it was let in, and one whose tests
failed never merged. `CI_GATE_ENABLED=true` restores the wait, and is correct only against
a CI that runs on every push.

`TASK_GATE=light` trades that invariant for time: each merge proves only that the tree
builds and lints, and the full suites run once at each cycle-gate entry against the tip
the cycle produced — roughly half an hour saved per cycle once each suite costs five
minutes. The price is attribution: a suite break surfaces at the gate naming no task, and
the recovery is to rerun the suites per merged task, fix, and restart the loop — the gate
stops the loop rather than promote a failing tip. A semantic conflict or broken build
still stops the task that introduced it, because compiling is exactly what the light gate
keeps.

Nothing reads the diff on the way through. Tasks merge on tests and the language check —
a defect neither can catch would reach the pull request unread.
`REVIEW_ENABLED` exists for that: the gate stops and waits for a person. `AUTO_REVIEW`
answers it instead, with a review task that reads the whole branch diff and reports
defects as `NEXT_TASK` lines, exactly as a scan reports findings. Each becomes a fix
task, and the fixes clear the cycle flag, so the gate returns through CI before the next
round reads the corrected diff. A round that finds nothing resumes the cycle;
`MAX_REVIEW_ROUNDS` bounds how many run, because a review still objecting to the same
diff is a disagreement another round will not settle.

Because each review reads the whole branch diff, reviewing every cycle re-reads work an
earlier review already accepted. `REVIEW_EVERY_N_CYCLES` runs the review on every Nth
cycle instead (1 = every cycle); an unreviewed cycle's work is still read by the next
reviewed one. The final cycle is always reviewed, and differently: its rounds continue
until one is clean, bounded by `MAX_FINAL_REVIEW_ROUNDS`, and exceeding that bound stops
the loop for a person instead of promoting a branch its own review keeps rejecting — the
round cap used to let exactly that ship.

A review is scoped to what the cycle changed — the scan is what looks at everything else.
It also commits nothing, which is why the merge commit check exempts it as it does a scan.

## The generated pull request

The title reports progress while cycles run (`cycle 4/12`) and what landed once the run
finishes (`6 features, 52 fixes, 6 security fixes`). The body is rebuilt each cycle into
fixed sections — Features, Bug Fixes, Security, Project Operations, Risks — carrying
`- None` where nothing matched. Both come from the same commit classification, so they
cannot disagree.

An HTML comment on the first line marks the text as generated. Editing the body by hand
removes it, and the loop stops overwriting from then on.

**The body is built from commit history, so a change reworked across cycles appears as
every intermediate step, including ones later reverted.** Only the diff shows what
survived, which is why `LOOP_DONE` says the summary still has to be written by hand
before anyone reviews it.

## Feeding it while it runs

The loop reads its queue on every poll, so it does not have to be stopped to be
given work. `npm run -C orchestration/ts delegate -- "<description>"` writes a specification from
the description, appends the shared testing requirements, and enqueues it —
queued work always runs ahead of the next scan. This is how a decision made in
conversation becomes the loop's next improvement: `/loop-delegate` covers turning
the decision into a description precise enough to survive the handoff.

In issue-queue mode, delegation publishes the shared fingerprint as ready work and leaves
claiming and local materialization to the daemon. An issue already carrying the fingerprint
is reused whether it is ready or claimed. A forge failure before any remote write warns and
falls back to the local queue; after creation may have reached the forge, the command aborts
unless the issue can be reconciled.

A task that merges while a cycle gate is already waiting on CI clears that
cycle's gate flag, so the gate pushes and verifies again with the new commits
included rather than passing on a stale verdict.

Scans run Codex at high reasoning effort by default and queued tasks at medium,
because a scan chooses the work while a queued task arrives fully specified.
`SCAN_EFFORT`, `TASK_EFFORT`, `SCAN_MODEL`, and `TASK_MODEL` change the defaults;
`delegate --effort` overrides them for one task.

`delegate --inspect` marks work that reports rather than changes anything, so its
merge is not rejected for producing no commits — the rejection exists to catch an
agent that forgot to commit, which is the opposite of an investigation that was
told not to. Its findings still reach the queue either way, because the loop reads
`NEXT_TASK` from the task's final-response file before it merges anything.

## Names, parallel scans, and pruning

Every generated task id is `YYYYMMDD_HHMMSS_nnn_<name>` — `nnn` a per-day
sequence, the name ending in `scan` for scans and starting with `ci-fix`,
`auto-`, or `user-` for CI fixes, scan findings, and delegated work — so a
listing sorts chronologically and age is visible without metadata. A
description is tied to its id through `queue/desc-index`: the same finding
reported twice, or the same decision delegated twice, resolves to one task.

Scans run several at a time — `SCAN_PARALLEL`, up to 4 — over disjoint groups of
the checklist's sections, because one scan reading everything was the slowest
step of every cycle. Their findings merge in the queue through that index, and a
cycle counts as empty only when every scan in it found nothing. `SCAN_PARALLEL=1`
restores the single full scan.

`npm run -C orchestration/ts prune` deletes what finished tasks leave behind — logs, status
files, generated specs, queue markers — once they are older than `--days`
(default 14). It never touches a task that is not merged or failed, a worktree
still on disk, or a spec tracked by git. `--dry-run` lists without deleting.

## Starting and stopping it

`/loop-start` and `/loop-stop` cover this, including what each setting changes and what
stopping leaves behind. Two things are worth knowing wherever you start it from: the
daemon holds the core modules it started with, so edits there take effect only after a
restart; the exception is the project adapter, which is reloaded before each scan so its
scan-worktree setup can change on the next scan. Stopping immediately terminates every
live task process tree and reports any tree it could not stop. Task specifications, logs,
status files, worktrees, and branches remain available for recovery or cleanup.

`npm run -C orchestration/ts loop-status` answers whether it is running and what is in flight, without
listing every task the repository has ever run.

## When a task fails

The loop prints `FAILED: <task-id>` with the path to its log, records the loss against the
cycle, and carries it into the pull request's risks. Nothing retries it: read the log,
correct the specification, `cleanup`, and `enqueue` it again. If a second attempt does not
get there, the specification is not what is wrong — take the work back and do it directly.

`cleanup` clears the markers the loop announces against, so a retry is watched rather than
run in silence.

**Several failing in one poll is the environment, not the specifications.** At
`MAX_BURST_FAILURES` (default 3) the loop stops instead of starting more, because the
cause is usually network, credentials, or the Codex CLI, and every task it starts
meanwhile burns its tokens reaching the same wall. Eleven were lost that way before this
existed, in a cycle the gate then announced as complete — work that never ran leaves no
diff, so neither CI nor the review can notice it is missing.

A merge failing is the same cause wearing a different symptom: the task finished, and the
gate that verifies it could not run. At `MAX_CONSECUTIVE_MERGE_FAILURES` (default 3) in a
row the loop stops, and any successful merge clears the count, so one task's genuine test
failure does not accumulate alongside unrelated ones. Where the merge log names Docker or
an unreachable registry the loop says which, because "tests failed" reads as the task's
fault and sends the next person to read a diff that is not wrong. Docker stopping mid-run
is what this is for: every backend task after it completed and failed to merge while the
frontend tasks carried on landing, and half a run arriving is harder to notice than none
of it. A remotely adopted issue labeled `loop:merge-failed` is not retried automatically;
after fixing the cause, relabel it `loop:merge-ready` to retry the adoption.
