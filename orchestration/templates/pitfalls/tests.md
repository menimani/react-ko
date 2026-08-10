## Known pitfalls — check your diff against every line before committing

<!-- Curation: at most 20 entries. A pattern earns a line only after reviews flagged it
     twice. At the cap, drop the lowest-impact entry to admit a new one; if a dropped
     pattern recurs, restore its line and let the list exceed the cap. -->

- Render through RootKnockoutProvider as a user would: a KnockoutScope with no bound root above it never binds, and the test passes or fails on unbound DOM either way.
- Assert rendered DOM, never Knockout internals — comment nodes, generated scope keys, or data-bind attribute strings lock in implementation, not behaviour.
- Bindings apply in useLayoutEffect during render(); after render returns they are live — but a reactive update still needs the observable actually changed, not the test's local copy.
- Cover all accepted prop shapes: a prop typed Observable | Computed | plain value is three behaviours, not one.
- Cover unmount: disposal, scope-key deletion, and that a second mount of the same component still binds (StrictMode runs effects twice in dev).
- Assert exact payloads and rendered results; "was called" or "is an array" locks nothing down.
- Reset mock implementations per test — clearAllMocks keeps implementations, so a predecessor's rejection leaks into the next test.
- Construct expected values independently; never seed an assertion from the code under test's own output.
- Fixtures satisfy the full type, timestamps included — the build gate typechecks what vitest does not.
