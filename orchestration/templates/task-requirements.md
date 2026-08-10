## Before reporting this done

Run `npm run test` from the repository root — the suite is vitest under jsdom — and then
`npm run build`. The build is the type gate: tsup emits declarations, so a type error
that vitest never sees fails there, and a suite pass without a build pass says nothing
about whether the merge gate will accept this.

The package supports React 18 and 19 and Knockout 3.5 as peer ranges. Do not use an API
that exists in only one supported major, and do not add a runtime dependency —
`package.json` ships with none, and that is a recorded decision, not an omission.

A change to public behaviour reaches users through `README.md` and `README.ja.md`
together. Updating one without the other leaves the pair contradicting each other,
which is worse than updating neither; if you cannot write the Japanese side, say so in
the report instead of skipping it silently.

Two traps have already cost time here. Bindings apply in `useLayoutEffect`, bottom-up:
a `KnockoutScope` rendered without a `RootKnockoutProvider` above it never binds, so a
test that renders a component bare is asserting on unbound DOM. And
`ko.observableArray` mutates in place — after `push` the array reference is unchanged,
so nothing that compares by reference will notice the update.
