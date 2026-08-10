# react-ko

en English | [ja 日本語](./README.ja.md)

[![npm version](https://img.shields.io/npm/v/react-ko)](https://www.npmjs.com/package/react-ko)

> A minimal bridge to use Knockout.js inside React components. Combine Knockout's reactivity with React's component architecture — clean, scoped, and type-safe.

---

## Features

- Seamless two-way data binding with Knockout observables
- Use `data-bind="..."` directly in JSX / TSX
- Scoped ViewModel logic via `<KnockoutScope>`
- One-line root binding via `<RootKnockoutProvider>`
- Type-safe list rendering with the `<KoForeach>` render prop
- `useKoValue` to read observables as React state
- No React event-handler or local-state boilerplate for DOM behavior handled through `data-bind`
- Full TypeScript & JavaScript support with zero-config
- No runtime dependencies other than Knockout & React

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

Template source: [`starter/ts`](./starter/ts)

---

### JavaScript

```bash
npx degit menimani/react-ko/starter/js my-app-js
cd my-app-js
npm install && npm run dev
```

Template source: [`starter/js`](./starter/js)

---

## Quick Usage (JSX / TSX)

```tsx
import ko from 'knockout'
import { RootKnockoutProvider, KnockoutScope } from 'react-ko'

const viewModel = {
  name: ko.observable('Alice')
}

<RootKnockoutProvider viewModel={{}}>
  <KnockoutScope viewModel={viewModel}>
    <input data-bind="value: name" />
  </KnockoutScope>
</RootKnockoutProvider>
```

`KoScope` is also exported as a shorter alias of `KnockoutScope`; both names
refer to the same component.

Replacing a `RootKnockoutProvider` or `KnockoutScope` `viewModel` reapplies its
Knockout bindings. Both components dispose their bindings when replaced or
unmounted.

---

## Custom Component Example

### JavaScript (JSX)

```jsx
import { KnockoutScope } from 'react-ko'

export function KoInput({ value }) {
  const vm = { value }

  return (
    <KnockoutScope viewModel={vm}>
      <input data-bind="value: value" />
    </KnockoutScope>
  )
}
```

### TypeScript (TSX)

```tsx
import ko from 'knockout'
import { KnockoutScope } from 'react-ko'

type Props = {
  value: ko.Observable<string>
}

export function KoInput({ value }: Props) {
  const vm = { value }

  return (
    <KnockoutScope viewModel={vm}>
      <input data-bind="value: value" />
    </KnockoutScope>
  )
}
```

### Component Usage

```tsx
const vm = {
  name: ko.observable('Alice')
}

<KnockoutScope viewModel={vm}>
  <KoInput value={vm.name} />
</KnockoutScope>
```

---

## Structural Components

Do not use Knockout control-flow bindings such as `if`, `ifnot`, `foreach`,
or `template` to control React-rendered children. Those bindings remove or
clone child DOM nodes that React still owns, which can leave React's DOM state
out of sync. Use `KoIf`, `KoIfNot`, and `KoForeach` instead.

### `KoForeach`

`KoForeach` takes a render prop: the function receives each item and its
index, and the JSX it returns is bound to that item — `data-bind` inside a
row refers to the row item directly.

```tsx
type Todo = {
  title: ko.Observable<string>
  done: ko.Observable<boolean>
}

const vm = { todos: ko.observableArray<Todo>([]) }

<KoForeach items={vm.todos}>
  {(todo, index) => (
    <li>
      <span>{index + 1}.</span>
      <input type="checkbox" data-bind="checked: done" />
      <input data-bind="value: title" />
      <button onClick={() => vm.todos.remove(todo)}>Remove</button>
    </li>
  )}
</KoForeach>
```

- `items` accepts `ko.ObservableArray<T>`, `ko.Observable<T[]>`,
  `ko.Computed<T[]>`, or a plain `T[]`.
- Instead of `$data`, `$index`, and `$parent`, use the function arguments
  and closures — outer variables (like `vm` above) are simply in scope, and
  React components can be used inside rows.
- Rows are keyed by `itemKey` when given; otherwise object items are keyed
  by identity and primitive items fall back to their index. Pass `itemKey`
  when rows hold state and items are primitive.

Nesting is plain JSX:

```tsx
<KoForeach items={vm.groups}>
  {(group) => (
    <section>
      <h2 data-bind="text: name" />
      <KoForeach items={group.items}>
        {(item) => <Row item={item} group={group} />}
      </KoForeach>
    </section>
  )}
</KoForeach>
```

### `KoIf` / `KoIfNot`

Render children while the condition is true (`KoIf`) or false (`KoIfNot`).
`data-bind` inside the children refers to the enclosing scope's view model.

```tsx
<KoIf condition={vm.isVisible}>
  <p data-bind="text: message" />
</KoIf>
```

---

## useAppViewModel

`useAppViewModel<T>()` reads the current application ViewModel. It must be used under an
`AppViewModelContext.Provider`. `RootKnockoutProvider` supplies this context provider
internally, and consumers may also supply `AppViewModelContext.Provider` directly.

---

## useKoValue

Reads a Knockout observable, computed, or plain value as React state: it
returns the current value and re-renders the component when it changes.
This is the one sanctioned route for bringing Knockout values into JSX
interpolation, effect dependencies, and props.

```tsx
import { useKoValue } from 'react-ko'

function Greeting({ name }: { name: ko.Observable<string> }) {
  const value = useKoValue(name) // string, re-renders on change
  return <p>Hello, {value}!</p>
}
```

---

## Migrating from v1

v2 contains breaking changes:

- **`KoForeach` children are now a function** `(item, index) => ReactNode`.
  The v1 form (plain JSX handed to Knockout's `foreach:` binding) is gone —
  it let Knockout clone DOM that React owned.
- **`KoIfComment`, `KoIfNotComment`, and `KoForeachComment` are removed**,
  as announced in v1. Use `KoIf`, `KoIfNot`, and `KoForeach`.
- **Each `KnockoutScope` is now its own binding root.** `$root` inside a
  scope refers to that scope's view model, and `$parent` does not cross
  scope borders; use props and closures instead.
- **`data-bind` inside `KoIf` / `KoIfNot` children** now resolves against
  the enclosing scope's view model (it previously saw an internal wrapper
  object holding the condition).

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

---

## License

MIT
