## Known pitfalls — check your diff against every line before committing

<!-- Curation: at most 20 entries. A pattern earns a line only after reviews flagged it
     twice. At the cap, drop the lowest-impact entry to admit a new one; if a dropped
     pattern recurs, restore its line and let the list exceed the cap. -->

- DOM ownership: Knockout's foreach/if/template bindings clone or remove child nodes React still holds fibers for; never let React re-render or unmount children that a Knockout binding controls.
- ko.applyBindings runs once at the root's mount; a data-bind node React mounts later is silently unbound — account for every conditional-render and late-mount path a change introduces.
- Binding order is layout-effect order, bottom-up: a scope must register its ViewModel before the root applies bindings; nothing re-binds when a plain (non-observable) scope key is reassigned afterwards.
- Dispose what you create: subscriptions and ko.computed need disposal on unmount, scope keys deleted, ko.cleanNode where Knockout was handed DOM; StrictMode double-invokes effects in dev, so registration and cleanup must be idempotent.
- ko.observableArray mutates in place — the reference is unchanged after push/splice; never rely on reference equality to detect an update.
- React 18 and 19 are both supported peers: no API that exists in only one of them, and no new runtime dependency — react, react-dom, and knockout stay peers.
- Everything exported from src/index.ts is public npm API: a signature change or removal is a major-version event, and the deprecated *Comment components stay until v2.0.0.
- data-bind is the user-facing surface by decision: do not export hooks or wrappers that expose observables as React state without an explicit go-ahead.
- The display:contents wrapper divs are structural, not stylable: give them no classes, styles beyond display, or ARIA roles.
- React.memo on the exported components compares props shallowly; an inline object or fresh children each render defeats it — do not rely on memo to keep a binding stable.
