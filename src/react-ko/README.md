# react-ko

en English | [ja Japanese](./README.ja.md)

[![npm version](https://img.shields.io/npm/v/react-ko)](https://www.npmjs.com/package/react-ko)

> A minimal bridge to use Knockout.js inside React components. Combine Knockout's reactivity with React's component architecture — clean, scoped, and type-safe.

**[Documentation](https://menimani.github.io/react-ko/)** — the full API, server
rendering, and migration from v2.

---

## Installation

```bash
npm install react-ko knockout
```

> This library requires `react` (`^18.0.0 || ^19.0.0`), `react-dom` (`^18.0.0 || ^19.0.0`), and `knockout` (`^3.5.1`) as peer dependencies. The package itself has no runtime dependencies.

---

## In one example

```tsx
import ko from 'knockout'
import { KnockoutScope, useKoValue, useKoViewModel } from 'react-ko'

const viewModel = {
  name: ko.observable('Knockout'),
  items: ko.observableArray<string>([]),
}

function Greeting() {
  const vm = useKoViewModel<typeof viewModel>()
  const count = (useKoValue(vm.items) ?? []).length

  return (
    <section>
      <input data-bind="value: name, valueUpdate: 'input'" />
      <p data-bind="text: name" />
      <p>{count} items (rendered by React)</p>
    </section>
  )
}

function App() {
  return (
    <KnockoutScope viewModel={viewModel}>
      <Greeting />
    </KnockoutScope>
  )
}
```

`KnockoutScope` is the ordinary way to establish a scope: every `data-bind` inside it
is applied against the view model, and `useKoViewModel` retrieves that model from any
React component in the scope. Nested scopes provide their own model.
`useKoValue` brings a Knockout value into React, for the places `data-bind` cannot
reach — JSX interpolation, props, effect dependencies.

There are five runtime exports: `KnockoutScope`, `useKoViewModel`, `useKoValue`,
`KoForeach` for lists, and `useKoBind` for making a particular existing element the
binding root when a wrapper cannot be used. A `useKoBind` host inside a closed shadow root or a detached tree such as a
`DocumentFragment` is rejected; use `KnockoutScope` there. TypeScript users can also import
`KoBindProps`, the type returned by `useKoBind`. The
[documentation](https://menimani.github.io/react-ko/) covers each.

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

The documentation site is the `docs/` directory, published by GitHub Pages. The
autonomous improvement loop that maintains this repository lives in
`orchestration/`; `orchestration/CLAUDE.md` explains how to run and resume it.

---

## License

MIT
