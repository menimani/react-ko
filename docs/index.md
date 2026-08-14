---
layout: default
lang: en
title: react-ko
description: A minimal bridge to use Knockout.js inside React components
---

# react-ko

en English | [ja Japanese](./ja/)

A minimal bridge to use Knockout.js inside React components. Knockout keeps the
reactivity and the `data-bind` attributes; React keeps the components, the tree, and
the elements it renders.

- [The whole API](#the-whole-api)
- [useKoBind](#usekobind)
- [useKoValue](#usekovalue)
- [KoForeach](#koforeach)
- [KnockoutScope](#knockoutscope)
- [useKoViewModel](#usekoviewmodel)
- [Server rendering and hydration](#server-rendering-and-hydration)
- [What Knockout may and may not own](#what-knockout-may-and-may-not-own)
- [Migrating from v2](#migrating-from-v2)
{: .toc}

---

## Installation

```bash
npm install react-ko knockout
```

`react` (`^18.0.0 || ^19.0.0`), `react-dom` (`^18.0.0 || ^19.0.0`) and `knockout`
(`^3.5.1`) are peer dependencies. The package itself has no runtime dependencies.

---

## The whole API

Five runtime exports. `KnockoutScope` establishes the ordinary scope, two hooks read
from it and from Knockout, one component renders lists, and one hook binds a specific
existing element. The public API also exports the `KoBindProps` type.

| Export | Direction | What it is for |
|--------|-----------|----------------|
| `useKoBind` | React → Knockout | Makes an element you rendered a binding root |
| `useKoValue` | Knockout → React | Reads an observable as React state |
| `KoForeach` | — | A row per item, each bound to that item |
| `KnockoutScope` | — | Binds and provides a view model to a subtree |
| `useKoViewModel` | Knockout scope → React | Reads the nearest scope's view model |
| `KoBindProps` | — | The props type returned by `useKoBind` |

Use `KnockoutScope` for an ordinary application or nested scope. Use `useKoBind` where
the binding root must be a particular element that a wrapper cannot contain.

---

## useKoBind

```ts
function useKoBind<T>(viewModel: T | null | undefined): KoBindProps
```

Returns props to spread onto a particular existing element that must become the
binding root. For an ordinary scope, use `KnockoutScope`.

```tsx
import ko from 'knockout'
import { useKoBind } from 'react-ko'

const vm = {
  name: ko.observable('Knockout'),
  color: ko.pureComputed(() => 'rebeccapurple'),
}

function Greeting() {
  const bind = useKoBind(vm)

  return (
    <section {...bind}>
      <input data-bind="value: name, valueUpdate: 'input'" />
      <p data-bind="text: name, style: { color: color }" />
    </section>
  )
}
```

Every `data-bind` inside that element is applied against the view model, reapplied
when the view model is replaced, and retired with `ko.cleanNode` when the element
goes away. Nothing is added to the DOM, so the tag, the attributes and the element's
place in the markup stay yours — including inside a `select`, a `tbody` or a `tr`,
where a wrapper element would be invalid.

### A nullish view model binds nothing

Which is what lets an element that is only sometimes rendered hold the props
unconditionally, since a hook cannot be called conditionally:

```tsx
const selected = useKoValue(vm.selected)
const bind = useKoBind(selected)

return selected ? <article {...bind} data-bind="text: title" /> : null
```

### One call, one element

Spreading the props of a single call onto two elements is reported as an error rather
than silently binding one of them: a binding root keeps a single host, so the second
element would take the first one's place.

### What the props contain

```ts
type KoBindProps = {
  ref: (node: HTMLElement | null) => void
  'data-react-ko-scope': string
}
```

The attribute marks the element as a binding root and carries a value from `useId`,
which is how the root finds its host in the mutation phase — early enough to bind
before anything inside the element runs a layout effect. Spread the props; do not
write the attribute yourself.

The `ref` is typed for `HTMLElement`, so an SVG or MathML root is a type error rather
than a runtime one.

---

## useKoValue

```ts
function useKoValue<T>(source: ko.ObservableArray<T>): T[]
function useKoValue<T>(source: ko.Observable<T> | ko.Computed<T> | T): T
function useKoValue<T>(source: ko.Observable<T> | ko.Computed<T> | T | undefined): T | undefined
```

`data-bind` covers DOM behavior that Knockout owns. React-rendered values — JSX
interpolation, props of a React component, an effect's dependency list — need the
value itself:

```tsx
function Greeting({ name }: { name: ko.Observable<string> }) {
  const value = useKoValue(name) // string, re-renders on change
  return <p>Hello, {value}!</p>
}
```

Pass the observable, not its value. `useKoValue(vm.name)` subscribes;
`vm.name()` reads once and never updates again, which shows the right value on the
first render and then quietly stops.

An optional source keeps its own shape: `ko.Observable<string> | undefined` returns
`string | undefined`. An observable array returns `T[]`. If the array value itself can
be nullish, use a nullable observable instead:

```tsx
const items = ko.observable<Item[] | null | undefined>(undefined)
const value = useKoValue(items) // Item[] | null | undefined
```

Plain values pass through unchanged, so a prop typed `ko.Observable<T> | T` can be
read either way. Knockout's deferred-updates mode (`ko.options.deferUpdates = true`)
is supported throughout; values arrive when the deferred notification runs.

---

## KoForeach

```tsx
<KoForeach items={vm.todos} itemKey={(todo) => todo.id}>
  {(todo, index, bind) => (
    <li {...bind}>
      <span>{index + 1}.</span>
      <input type="checkbox" data-bind="checked: done" />
      <input data-bind="value: title" />
      <button onClick={() => vm.todos.remove(todo)}>Remove</button>
    </li>
  )}
</KoForeach>
```

A component rather than a hook for one reason: a hook cannot be called in a loop, and
each row needs its own binding root. The render prop receives that root as its third
argument.

Use `KoForeach` when rows contain `data-bind`. If they do not, the list is plain React:

```tsx
const items = useKoValue(vm.items)

return items.map((item) => <Row key={item.id} item={item} />)
```

Use ordinary React keys in that case. `KoForeach` only adds the per-row Knockout
binding root, so it adds nothing to a list whose rows do not bind.

- `items` accepts mutable and readonly arrays, and observable and computed sources.
  The value may be `null` or `undefined`; either renders an empty list.
- Nothing is added to the DOM around a bound row, so `select`, `tbody` and `tr` need no
  special handling.
- Instead of `$data`, `$index` and `$parent`, use the arguments and closures. Outer
  variables are in scope, and React components can be used inside a row.
- Rows are keyed by `itemKey` when given. Otherwise object items are keyed by
  identity and occurrence, so repeated references stay distinct, and primitive items
  fall back to their index — pass `itemKey` when rows hold state and items are
  primitive.

Conditionals need no component, because `useKoValue` already gives you the value:

```tsx
const visible = useKoValue(vm.visible)

return visible ? <section {...bind}>…</section> : null
```

---

## KnockoutScope

```tsx
<KnockoutScope viewModel={vm}>
  <LazyPanel />
</KnockoutScope>
```

`useKoBind` finds its marked host in the mutation phase, before descendant layout
effects run. It also observes descendants added after the initial binding pass.

`KnockoutScope` is the ordinary scoping API: it binds the subtree and provides the view
model to React components through `useKoViewModel`. Its component-owned position in the
tree also lets it render an inert marker before its host, so it can announce a view-model
replacement before a child or portal added or rebound by the same commit is observed.

Its hosts are plain `div`s with `display: contents`, and it does not let you choose
them. An element that has to be something else — such as an `option`, `tr`, or `li` —
is yours, through `useKoBind`.

---

## useKoViewModel

```ts
function useKoViewModel<T>(): T
```

Returns the view model from the nearest `KnockoutScope`:

```tsx
import { KnockoutScope, useKoViewModel } from 'react-ko'

function Panel() {
  const vm = useKoViewModel<AppViewModel>()
  return <button data-bind="click: save">Save {vm.title}</button>
}

function App() {
  return (
    <KnockoutScope viewModel={new AppViewModel()}>
      <Panel />
    </KnockoutScope>
  )
}
```

The type argument states the application's view-model type; React context cannot infer
it across the component boundary. The hook throws outside a `KnockoutScope`. `null` and
`undefined` are valid scope values when included in `T`, and nested scopes return the
nearest view model.

---

## Server rendering and hydration

A `useKoBind` root renders on the server without adding an element of its own. Refs
do not run there, so no bindings are applied; the markup is exactly what the caller
wrote, plus the binding-root attribute. Hydration reuses those elements and attaches
the bindings afterwards, so a `select` rendered on the server contains only `option`
elements, and hydration does not replace them. `KnockoutScope`, by contrast, renders
its two `display: contents` hosts and commit marker on the server as well as the
children passed to it. Its view model is available through `useKoViewModel` during
server rendering even though DOM bindings wait for hydration.

Bindings inside a dehydrated Suspense boundary are deferred until the boundary
resolves.

---

## What Knockout may and may not own

React owns every element the library hands to Knockout. Knockout may own the contents
of an element React left empty — through `text`, `html`, `component` or `options` —
but a binding that would control children React rendered is rejected, with an error
naming the binding, rather than allowed to fight React over the same nodes.

Bindings are retired when their `data-bind` changes or the element goes away, and the
DOM effects they left behind — attributes, classes, inline styles, focus, checked and
disabled state, the implicit radio name — are restored.

---

## Migrating from v2

| v2 | v3 |
|----|----|
| `<RootKnockoutProvider viewModel={vm}>…</RootKnockoutProvider>` | `<KnockoutScope viewModel={vm}>…</KnockoutScope>` |
| `<KnockoutScope viewModel={vm}>…</KnockoutScope>` | Unchanged; it now also provides `vm` to `useKoViewModel` |
| `<KoIf condition={c}>…</KoIf>` | `useKoValue(c) ? … : null` |
| `<KoIfNot condition={c}>…</KoIfNot>` | `useKoValue(c) ? null : …` |
| `<KoWith value={v}>{(x) => …}</KoWith>` | `const x = useKoValue(v); const bind = useKoBind(x)`, then `x ? <div {...bind}>…</div> : null` |
| `<KoForeach>{(item, i) => …}</KoForeach>` | `<KoForeach>{(item, i, bind) => …}</KoForeach>` |
| `boundaryAs`, `as`, `bindingMode` | Gone. The element is yours, so its tag is too |
| `SemanticHost`, `SemanticHostProps` | Gone with them |
| `createAppViewModelContext`, `useAppViewModel`, `AppViewModelContext` | `useKoViewModel<T>()` inside `KnockoutScope` |
| `KoScope` | Gone; `KnockoutScope` is the name |

`useKoValue` is unchanged.

---

[Source on GitHub](https://github.com/menimani/react-ko) ·
[npm](https://www.npmjs.com/package/react-ko)
