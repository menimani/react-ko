# react-ko

en English | [ja Japanese](./README.ja.md)

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

---

### JavaScript

```bash
npx degit menimani/react-ko/starter/js my-app-js
cd my-app-js
npm install && npm run dev
```

Template source: [`starter/js`](https://github.com/menimani/react-ko/tree/main/starter/js)

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

Scopes render two unstyled host elements: the outer binding boundary and the
inner binding root. Both default to `div`. Use `boundaryAs` and `as` to choose
semantic HTML when a `div` is not valid in that position. The same props are
available on `RootKnockoutProvider`, `KoIf`, `KoIfNot`, `KoForeach`, and
`KoWith`. For example, use phrasing hosts inside a button:

```tsx
<button>
  <KnockoutScope viewModel={viewModel} boundaryAs="span" as="span">
    <span data-bind="text: name" />
  </KnockoutScope>
</button>
```

The host elements remain structural: they receive only the binding boundary or
binding-root ref and `display: contents`, not styling or ARIA props. Because both
hosts always contain children, `boundaryAs` and `as` accept non-void HTML elements.
Additional non-void names added through `HTMLElementTagNameMap` declaration merging
are supported at both the type and runtime boundaries and do not need a hyphen.
Known void tags such as `input`, `img`, and `br`, and foreign-content roots such as
`svg`, are rejected at runtime.

Replacing a `RootKnockoutProvider` or `KnockoutScope` `viewModel` reapplies its
Knockout bindings. Both components dispose their bindings when replaced or
unmounted. If applying a binding tree throws, subscriptions created earlier in
that pass are also disposed before the error reaches a React error boundary.
Root providers and scopes can be nested: each is a descendant-binding boundary,
so its children use only its own `viewModel` and are cleaned up with that binding
root.
react-ko reserves the Knockout binding names `reactKoScopeBoundary` and
`reactKoCaptureDescendantContext`; loading the library throws if another handler
has already registered either name.
React-rendered descendants mounted after the initial binding pass are also bound
automatically to the nearest root or scope, before their layout effects run. When
mounted below an existing Knockout `using` or `let` binding, they retain that
binding's descendant context.
Their bindings are disposed when React removes them. Errors from these late-applied
bindings also reach the nearest React error boundary. When React changes an existing
element's `data-bind` attribute, the previous binding is disposed and the new
expression is applied in that same descendant context. Retiring a `text`, `html`,
`component`, or `options` binding also removes the content Knockout created before
the current binding or React-rendered children take ownership. Other replaced
bindings restore the attributes, classes, styles, and form properties owned by
the previous expression before applying the next one; a custom binding is rejected
if its DOM effects cannot be safely retired.
Custom bindings that do not control descendants, such as tooltip bindings, remain
supported on elements with React-rendered children and are responsible for leaving those
children in place. A custom binding may use an empty element only when it creates all
owned content during initial binding. Content inserted by a later custom-binding update
is not tracked as owned and may be rebound or rejected as a late descendant, so that
pattern is not supported.
React prop updates and active Knockout bindings can also share an element: React's
latest classes, inline styles, attributes, and form-property defaults are retained,
while the active Knockout binding continues to own the DOM effects it declares.
When React later inserts an `option` or changes its `value`, `selectedOptions` and
`value` with `valueAllowUnset` are reapplied so a late matching option is synchronized
without another observable notification.
When an `attr` binding is removed, React attribute props are restored with React DOM
serialization, including aliased props such as `acceptCharset`/`httpEquiv`, absent false
boolean props such as `inert` and media disabling props, and empty presence values for
boolean `download` and `capture`.

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

`KnockoutScope` calls `useAppViewModel` internally, so it must be rendered under
either `RootKnockoutProvider` or an `AppViewModelContext.Provider`. The root
provider also applies bindings for any `data-bind` attributes outside nested
scopes. On client-only mounts, both components establish their binding host
before mounting children, so descendant layout effects interact with DOM that
is already bound. During server rendering and hydration, they preserve the
server-rendered child subtree so React can hydrate it in place.

```tsx
import ko from 'knockout'
import { RootKnockoutProvider } from 'react-ko'

const vm = {
  name: ko.observable('Alice')
}

<RootKnockoutProvider viewModel={vm}>
  <KoInput value={vm.name} />
</RootKnockoutProvider>
```

---

## Structural Components

Do not use Knockout control-flow bindings `if`, `ifnot`, `foreach`, `template`,
or `with` to control React-rendered children. Those bindings remove or clone
child DOM nodes that React still owns. `RootKnockoutProvider` and
`KnockoutScope` reject them before applying any bindings in that binding root.
Use `KoIf`, `KoIfNot`, `KoForeach`, and `KoWith` instead.

The `text`, `html`, `component`, and `options` bindings also replace an
element's contents. They are supported only when the bound element has no
React-rendered children; otherwise the binding is rejected before it can detach
those children. Direct React scalar text and content inserted with
`dangerouslySetInnerHTML` are treated as React-rendered children too. React 19 renders
`bigint` children as scalar text, so they have the same restriction; React 18 renders
them as no output, so a `bigint` child alone does not conflict with a content binding. This
remains enforced if React conditionally adds children after
the binding was applied. React element insertion is rejected synchronously,
before the child's layout effects run, and direct text or HTML insertion is
rejected during late reconciliation. Leave the element empty while Knockout
owns its contents. Transitions that add or remove an explicit empty-string child
or an empty `dangerouslySetInnerHTML` payload are rejected too, because those
React updates clear Knockout-owned content. React can hand existing text or HTML
off by removing it in the same render that adds the content binding.

### `KoForeach`

`KoForeach` takes a render prop: the function receives each item and its
index, and the JSX it returns is bound to that item — `data-bind` inside a
row refers to the row item directly.

```tsx
import ko from 'knockout'
import { KoForeach, RootKnockoutProvider } from 'react-ko'

type Todo = {
  title: ko.Observable<string>
  done: ko.Observable<boolean>
}

const vm = { todos: ko.observableArray<Todo>([]) }

<RootKnockoutProvider viewModel={vm}>
  <ul>
    <KoForeach items={vm.todos} boundaryAs="li" as="div">
      {(todo, index) => (
        <div>
          <span>{index + 1}.</span>
          <input type="checkbox" data-bind="checked: done" />
          <input data-bind="value: title" />
          <button onClick={() => vm.todos.remove(todo)}>Remove</button>
        </div>
      )}
    </KoForeach>
  </ul>
</RootKnockoutProvider>
```

- `items` accepts `ko.ObservableArray<T>`, `ko.Observable<T[]>`,
  `ko.Computed<T[]>`, or a plain `T[]`. The array value may be `null` or
  `undefined` for plain, observable, and computed sources; either renders an
  empty list.
- Instead of `$data`, `$index`, and `$parent`, use the function arguments
  and closures — outer variables (like `vm` above) are simply in scope, and
  React components can be used inside rows.
- Rows are keyed by `itemKey` when given; otherwise object items are keyed
  by identity and occurrence (so repeated references remain unique), while
  primitive items fall back to their index. Pass `itemKey` when rows hold
  state and items are primitive.
- `boundaryAs` and `as` select the two hosts for every row. In the example,
  each outer `li` is a valid direct child of `ul`; the render callback returns
  its contents rather than another `li`.

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
import ko from 'knockout'
import { KoIf, RootKnockoutProvider } from 'react-ko'

const vm = {
  isVisible: ko.observable(true),
  message: ko.observable('Hello')
}

<RootKnockoutProvider viewModel={vm}>
  <KoIf condition={vm.isVisible}>
    <p data-bind="text: message" />
  </KoIf>
</RootKnockoutProvider>
```

### `KoWith`

Render children for a non-nullish value and bind the returned JSX to that
value. The render prop replaces `$data`; use closures for values from outer
scopes. `value` accepts an observable, computed, or plain nullable value.
Falsy values such as `false`, `0`, and `''` are present values.

```tsx
import ko from 'knockout'
import { KoWith, RootKnockoutProvider } from 'react-ko'

type Todo = { title: ko.Observable<string> }

const vm = {
  selectedTodo: ko.observable<Todo | null>({
    title: ko.observable('Write documentation')
  })
}

<RootKnockoutProvider viewModel={vm}>
  <KoWith value={vm.selectedTodo}>
    {() => (
      <section>
        <input data-bind="value: title" />
        <button onClick={() => vm.selectedTodo(null)}>Remove</button>
      </section>
    )}
  </KoWith>
</RootKnockoutProvider>
```

---

## useAppViewModel

For provider-linked typing, create a matched Provider and hook once. The ViewModel type
is fixed at creation and cannot be replaced with an unrelated type when the hook is used:

```tsx
import { createAppViewModelContext, RootKnockoutProvider } from 'react-ko'

type AppViewModel = { title: string }
const TypedAppViewModelContext = createAppViewModelContext<AppViewModel>()
const vm: AppViewModel = { title: 'Hello' }

function Title() {
  const vm = TypedAppViewModelContext.useAppViewModel() // AppViewModel
  return <h1>{vm.title}</h1>
}

<TypedAppViewModelContext.Provider value={vm}>
  <RootKnockoutProvider viewModel={vm}>
    <Title />
  </RootKnockoutProvider>
</TypedAppViewModelContext.Provider>
```

The matched hook throws if its matching Provider is absent. The legacy
`useAppViewModel<T>()` and `AppViewModelContext.Provider` remain available in v2, but
the hook's generic is an unchecked assertion and is deprecated. The supplied ViewModel
is returned unchanged; `null` and `undefined` are valid values when included in `T`.

---

## useKoValue

Reads a Knockout observable, computed, or plain value as React state: it
returns the current value and re-renders the component when it changes.
This is the one sanctioned route for bringing Knockout values into JSX
interpolation, effect dependencies, and props.

```tsx
import type * as ko from 'knockout'
import { useKoValue } from 'react-ko'

function Greeting({ name }: { name: ko.Observable<string> }) {
  const value = useKoValue(name) // string, re-renders on change
  return <p>Hello, {value}!</p>
}
```

An optional source keeps its shape: `useKoValue` of a
`ko.Observable<string> | undefined` prop returns `string | undefined`.
Knockout's deferred-updates mode (`ko.options.deferUpdates = true`) is
supported throughout the library; values arrive when the deferred
notification runs.

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
