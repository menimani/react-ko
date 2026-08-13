# react-ko

en English | [ja Japanese](./README.ja.md)

[![npm version](https://img.shields.io/npm/v/react-ko)](https://www.npmjs.com/package/react-ko)

> A minimal bridge to use Knockout.js inside React components. Combine Knockout's reactivity with React's component architecture — clean, scoped, and type-safe.

---

## Features

- Seamless two-way data binding with Knockout observables
- Use `data-bind="..."` directly in JSX / TSX
- `useKoBind` turns your own element into a binding root, adding nothing to the DOM
- `useKoValue` reads observables as React state
- Type-safe list rendering with the `<KoForeach>` render prop
- No React event-handler or local-state boilerplate for DOM behavior handled through `data-bind`
- Full TypeScript & JavaScript support with zero-config
- No runtime dependencies other than Knockout, React & React DOM

---

## Installation

```bash
npm install react-ko knockout
```

> This library requires `react` (`^18.0.0 || ^19.0.0`), `react-dom` (`^18.0.0 || ^19.0.0`), and `knockout` (`^3.5.1`) as peer dependencies.

---

## Quick Start with Starter Template

### TypeScript

```bash
npx degit menimani/react-ko/starter/ts my-app-ts
cd my-app-ts
npm install && npm run dev
```

Template source: [`starter/ts`](https://github.com/menimani/react-ko/tree/main/starter/ts)

### JavaScript

```bash
npx degit menimani/react-ko/starter/js my-app-js
cd my-app-js
npm install && npm run dev
```

Template source: [`starter/js`](https://github.com/menimani/react-ko/tree/main/starter/js)

---

## The whole API

Four exports. Two of them are the bridge, one is a list, one is for the case the
bridge cannot serve.

| Export | What it is for |
|--------|----------------|
| `useKoBind` | React to Knockout: makes an element you rendered a binding root |
| `useKoValue` | Knockout to React: reads an observable as React state |
| `KoForeach` | A row per item, each bound to that item |
| `KnockoutScope` | A scope that renders its own host, for children that arrive later |

---

## Quick Usage (JSX / TSX)

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

`useKoBind` returns props to spread onto the element you already have. That element
is the binding root: every `data-bind` inside it is applied against the view model,
reapplied when the view model is replaced, and retired with `ko.cleanNode` when the
element goes away. Nothing is added to the DOM, so the tag, the attributes, and the
element's place in your markup stay yours — including in a `select`, a `tbody`, or
anywhere else a wrapper would be invalid.

A nullish view model binds nothing, which is what lets an element that is only
sometimes rendered hold the props unconditionally:

```tsx
const selected = useKoValue(vm.selected)
const bind = useKoBind(selected)

return selected ? <article {...bind} data-bind="text: title" /> : null
```

Call `useKoBind` once per element. Spreading one call's props onto two elements is
reported rather than silently binding one of them.

---

## Reading values in React: `useKoValue`

`data-bind` covers what lives on a DOM attribute. Anything else — JSX interpolation,
props of a React component, an effect's dependency list — needs the value itself:

```tsx
import { useKoValue } from 'react-ko'

function Greeting({ name }: { name: ko.Observable<string> }) {
  const value = useKoValue(name) // string, re-renders on change
  return <p>Hello, {value}!</p>
}
```

Pass the observable, not its value: `useKoValue(vm.name)` subscribes, while
`vm.name()` reads once and never updates again.

An optional source keeps its shape: `useKoValue` of a `ko.Observable<string> | undefined`
returns `string | undefined`. An observable array returns `T[] | null | undefined`,
because that is what it holds at runtime; guard it where an empty array is the
fallback you want:

```tsx
const items = useKoValue(vm.items) ?? []
```

Knockout's deferred-updates mode (`ko.options.deferUpdates = true`) is supported
throughout; values arrive when the deferred notification runs.

---

## Lists: `KoForeach`

`KoForeach` renders its render prop once per item and hands it a binding root for
that item. Spread it onto the row's own element:

```tsx
import ko from 'knockout'
import { KoForeach, useKoBind } from 'react-ko'

type Todo = {
  title: ko.Observable<string>
  done: ko.Observable<boolean>
}

const vm = { todos: ko.observableArray<Todo>([]) }

function Todos() {
  const bind = useKoBind(vm)

  return (
    <ul {...bind}>
      <KoForeach items={vm.todos}>
        {(todo, index, rowBind) => (
          <li {...rowBind}>
            <span>{index + 1}.</span>
            <input type="checkbox" data-bind="checked: done" />
            <input data-bind="value: title" />
            <button onClick={() => vm.todos.remove(todo)}>Remove</button>
          </li>
        )}
      </KoForeach>
    </ul>
  )
}
```

- `items` accepts mutable or readonly arrays, including observable and computed
  sources. The array value may be `null` or `undefined`; either renders an empty list.
- A row that binds nothing can ignore the third argument. Nothing is added to the DOM
  either way, so `select`, `tbody`, and `tr` need no special handling.
- Instead of `$data`, `$index`, and `$parent`, use the function arguments and
  closures — outer variables are simply in scope, and React components can be used
  inside rows.
- Rows are keyed by `itemKey` when given; otherwise object items are keyed by identity
  and occurrence (so repeated references stay distinct), while primitive items fall
  back to their index. Pass `itemKey` when rows hold state and items are primitive.

Conditionals are plain React, because `useKoValue` already gives you the value:

```tsx
const visible = useKoValue(vm.visible)

return visible ? <section {...bind}>…</section> : null
```

---

## Children that arrive later: `KnockoutScope`

`useKoBind` binds the element it is given, from a ref. React attaches refs from the
bottom up and runs a component's effects after its subtree's, so a root taken from a
ref learns about its subtree last. That is invisible in most trees and matters in two
places: a descendant whose own layout effect writes to Knockout-owned DOM on the very
first commit, and a view model replaced in the same commit as a child that arrives
with it.

`KnockoutScope` renders an inert marker before its host, and a first child's ref and
effects run before its siblings' — which is what lets it bind those cases correctly:

```tsx
import { KnockoutScope } from 'react-ko'

<KnockoutScope viewModel={vm}>
  <LazyPanel />
</KnockoutScope>
```

Its hosts are plain `div`s with `display: contents`. An element that has to be
something else is your own, through `useKoBind`.

---

## Providing the ViewModel to a subtree

That is plain React, so react-ko does not ship it:

```tsx
import { createContext, useContext } from 'react'

const AppViewModelContext = createContext<AppViewModel | null>(null)

export function useAppViewModel() {
  const viewModel = useContext(AppViewModelContext)
  if (viewModel === null) throw new Error('Missing provider')
  return viewModel
}
```

The starters show it in place.

---

## Migrating from v2

v3 replaces the scope components with a hook. The rule of thumb: wherever a component
used to render a host for you, spread `useKoBind` onto the element you want bound.

| v2 | v3 |
|----|----|
| `<RootKnockoutProvider viewModel={vm}>…</RootKnockoutProvider>` | `<div {...useKoBind(vm)}>…</div>` |
| `<KnockoutScope viewModel={vm}>…</KnockoutScope>` | `<div {...useKoBind(vm)}>…</div>`, or keep `KnockoutScope` for later-arriving children |
| `<KoIf condition={c}>…</KoIf>` | `useKoValue(c) ? … : null` |
| `<KoIfNot condition={c}>…</KoIfNot>` | `useKoValue(c) ? null : …` |
| `<KoWith value={v}>{(x) => …}</KoWith>` | `const x = useKoValue(v)`, then `x ? <div {...useKoBind(x)}>…</div> : null` |
| `<KoForeach>{(item, i) => …}</KoForeach>` | `<KoForeach>{(item, i, bind) => …}</KoForeach>` |
| `boundaryAs` / `as` / `bindingMode` | Gone. The element is yours, so its tag is too |
| `SemanticHost`, `SemanticHostProps` | Gone with them |
| `createAppViewModelContext`, `useAppViewModel`, `AppViewModelContext` | Plain React context, as above |

`useKoValue` is unchanged.

---

## Why react-ko?

Without react-ko (pure React):

```tsx
<input
  value={value}
  onChange={(e) => setValue(e.target.value)}
  style={{ color }}
/>
```

With react-ko:

```tsx
<input data-bind="value: value, style: { color: color }" />
```

For DOM behavior handled through `data-bind`, there is no need to wire React events or manage local state.
Let Knockout observables do the work — even in modern React.

---

## Development

```bash
npm install
npm run build
```

Enable the repository hooks once per clone:

```bash
git config core.hooksPath .githooks
```

The starters are npm workspaces: after the root install they run against the
local library without publishing.

```bash
npm run dev --workspace=starter/ts
```

The autonomous improvement loop that maintains this repository lives in
`orchestration/`; `orchestration/CLAUDE.md` explains how to run and resume it.

---

## License

MIT
