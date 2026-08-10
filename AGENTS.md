# AGENTS.md

The rules for this repository live in **`CLAUDE.md`**. Read it before making changes.

It is short on purpose: it carries only what the source cannot tell you, so treat every
line in it as binding. How a component works and which command runs the tests are
answered better by the code than by a summary of it.

Two of its rules are the ones agents break most: everything exported from
`src/react-ko/src/index.ts` is public npm API whose breaking changes belong to a major version, and
the package accepts no new runtime dependencies — `react`, `react-dom`, and `knockout`
stay peer dependencies.

## When running as an orchestrated task

Tasks dispatched by `orchestration/` run in a dedicated git worktree. Two things are
required of you there, and both have been missed repeatedly in practice:

1. **Commit your work.** The merge step reads commits, not the working tree. Changes left
   uncommitted abort the merge and have to be recovered by hand.
2. **Print `TASK_COMPLETE`** on its own line as the final message. Completion is detected
   by that marker; without it the task is recorded as failed even when the work is done.

Report `TASK_COMPLETE` only once the completion criteria in the task specification are
actually met, including any tests it asks you to run.
