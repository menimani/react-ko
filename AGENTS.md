# AGENTS.md

The rules for this repository live in **`CLAUDE.md`**. Read it before making changes.

It is short on purpose: it carries only what the source cannot tell you, so treat every
line in it as binding. How a component works and which command runs the tests are
answered better by the code than by a summary of it.

Two of its rules are the ones agents break most: everything exported from
`src/react-ko/src/index.ts` is public npm API whose breaking changes belong to a major version, and
the package accepts no new runtime dependencies — `react`, `react-dom`, and `knockout`
stay peer dependencies.
