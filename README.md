# react-ko

en English | [ja 日本語](./README.ja.md)

[![npm version](https://img.shields.io/npm/v/react-ko)](https://www.npmjs.com/package/react-ko)

> 🧠 A minimal bridge to use Knockout.js inside React components.  
> Combine Knockout's reactivity with React's component architecture — clean, scoped, and type-safe.

---

## ✨ Features

- ✅ Seamless two-way data binding with Knockout observables
- ✅ Use `data-bind="..."` directly in JSX / TSX
- ✅ Scoped ViewModel logic via `<KnockoutScope>`
- ✅ One-line root binding via `<RootKnockoutProvider>`
- ✅ Zero boilerplate — no event handlers or local state
- ✅ Full TypeScript & JavaScript support with zero-config
- ✅ No runtime dependencies other than Knockout & React

---

## 📦 Installation

```bash
npm install react-ko knockout
```

> ⚠️ This library requires `react` (v18+) and `knockout` (v3.5+) as peer dependencies.

---

## 🚀 Quick Usage (JSX / TSX)

```tsx
import ko from 'knockout'
import { RootKnockoutProvider, KnockoutScope } from 'react-ko'

const viewModel = {
  name: ko.observable('Alice')
}

<RootKnockoutProvider viewModel={viewModel}>
  <KnockoutScope viewModel={viewModel}>
    <input data-bind="value: name" />
  </KnockoutScope>
</RootKnockoutProvider>
```

---

## 🧩 Custom Component Example

### ▶️ JavaScript (JSX)

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

### ▶️ TypeScript (TSX)

```tsx
import { KnockoutScope } from 'react-ko'

type Props = {
  value: KnockoutObservable<string>
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

### ▶️ Component Usage

```tsx
const vm = {
  name: ko.observable('Alice')
}

<KnockoutScope viewModel={vm}>
  <KoInput value={vm.name} />
</KnockoutScope>
```

### ❗ Deprecated Components

> ⚠️ The following components are deprecated and will be removed in a future release (v2.0.0):
>
> - `KoIfComment`
> - `KoIfNotComment`
> - `KoForeachComment`
>
> Please use the unified components instead:
>
> - ✅ `KoIf`
> - ✅ `KoIfNot`
> - ✅ `KoForeach`
>
> These new components are fully JSX-compliant and no longer rely on HTML comment nodes.

---

## 🤔 Why react-ko?

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

No need to wire events or manage local state.  
Let Knockout observables do the work — even in modern React.

---

## 📁 Folder Structure

```
src/
├── components/                          // Components
│   ├── scope/                          // Core components for binding with Knockout
│   │   ├── KnockoutScope.tsx          // Manages the Knockout and React scope
│   │   └── RootKnockoutProvider.tsx   // Root component, initializes Knockout
│   ├── structural/                     // Generic components for Knockout flow control
│   │   ├── KoIf.tsx                   // ko if: control component
│   │   ├── KoIfNot.tsx                // ko ifnot: control component
│   │   ├── KoForeach.tsx              // ko foreach: control component
├── context/                             // Context management
│   ├── AppViewModelContext.ts          // Context related to Knockout's ViewModel
```

---

## 🛠 Development

```bash
npm install
npm run build
```

---

## 📄 License

MIT