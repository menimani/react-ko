# CLAUDE.md

react-ko is a minimal bridge library for using Knockout.js inside React components,
published to npm as `react-ko`. The package lives in the `src/react-ko` npm workspace
(TypeScript sources in `src/react-ko/src`, vitest suites in `src/react-ko/tests`, a tsup
build into `src/react-ko/dist`); the root package.json proxies `npm test` and
`npm run build` into it. `starter/ts` and `starter/js` are the in-repo starter
templates, kept on the current API in the same change that moves it.

`README.md` and `README.ja.md` describe the library to its users.
`orchestration/CLAUDE.md` covers delegating work to Codex. Open one when a change
touches what it records.

This file holds only what the source cannot tell you: the rules a reasonable change would
otherwise break. Everything about how a component works or which command runs the tests
is better learned from the code itself.

## Follow what is already there

Find an existing implementation of the same kind and follow it — its naming, comment
density, and test style. Components live under `src/react-ko/src/components/` by role (scope,
structural), and every component has a matching test under `tests/` mirroring the path.
Where neither settles it, propose the candidates and ask before writing.

This outranks your own preferences. Do not relocate, rename, or redesign existing code
unless that is the task, and do not bundle opportunistic refactors, dependency bumps, or
cleanups into an unrelated change. A commit serves one purpose and says what changed
and why.

## The public API is a contract

Everything exported from `src/react-ko/src/index.ts` is public API on npm. A signature change or a
removal is a breaking change and belongs to a major version, never to a fix. The
comment-based compat components were removed in v2.0.0 as announced; do not reintroduce
them.

Publishing to npm is the maintainer's manual act. Never run `npm publish` or change
`version` in `package.json` on your own judgement.

## No runtime dependencies

The package ships with zero runtime dependencies: `react`, `react-dom`, and `knockout`
are peer dependencies and stay that way. Adding a runtime dependency is a design
decision that needs agreement, not a convenience call.

## Text-only elements and templates are not semantic hosts

Rejecting `textarea` and `title` as `boundaryAs` or `as` values at runtime is a decided
bug fix, not a compatibility restriction deferred to a future major version. Browsers
cannot preserve the child element subtree that a react-ko scope host requires. Keep
these names in the public `SemanticHost` type for TypeScript compatibility, but do not
restore their runtime acceptance.

Rejecting `template` as a semantic host is also a decided bug fix. A scope host must
keep its children in the document tree, while a `<template>` stores its children in its
`content` fragment. Keep the name in the public `SemanticHost` type for TypeScript
compatibility, but do not implement template hydration or restore runtime acceptance.

## data-bind is the user-facing surface, by decision

The library's premise is absorbing Knockout into JSX without multiplying components:
users write `data-bind` attributes inside a `KnockoutScope`, and the component set stays
minimal. The v2 decision (2026-08) added exactly one React-side bridge: `useKoValue`,
the sanctioned route for reading a Knockout value as React state, which `KoForeach`,
`KoIf`, and `KoIfNot` also use internally. Any further React-side alternative to
`data-bind` (`observer`-style wrappers, write-side hooks) still changes the library's
identity and needs agreement first. Internal use of such mechanisms inside a component
is fine; exporting them is the decision.

## Both READMEs move together

`README.md` (English) and `README.ja.md` (Japanese) are translations of each other.
A change to one is incomplete until the other says the same thing. This pair is where
Japanese belongs; code, comments, tests, commit messages, and pull requests are written
in English.

## dist/ is generated

`src/react-ko/dist/` is what `npm run build` (tsup) emits and what the package ships. Never edit it
by hand; a change that matters happens in `src/` and is proven by rebuilding.

## Leave nothing that does not work

No placeholder bodies, truncated files, or unresolved TODOs; every file you touch must
build. A change is finished when you can explain its purpose and impact to a reviewer and
either tests cover it or you have said why they do not and how you verified it instead.
Reporting something finished while a build, test, or static analysis failure is known to
remain is worse than reporting it unfinished.

## Git

Branch as `feature/`, `fix/`, or `chore/`, and never commit to `main` directly. Commit
subjects begin with `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, or `chore:`.

**Stop and report** before any force push or history rewrite, and when a merge conflict
touches the public API. Those are the user's decisions to make, not yours.

## Windows shell

Redirect to `/dev/null`. Never `nul` — Git Bash creates a literal file by that name and
it gets committed. Use `ls`, `cat`, `rm` rather than `dir`, `del`, `type`.
