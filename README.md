# react-ko

> 🧠 A minimal bridge library to use Knockout.js inside React components.  
> Combine Knockout's reactivity with React's component architecture.

---

## ✨ Features

- ✅ Seamless integration between React and Knockout
- ✅ Two-way binding with Knockout observables
- ✅ No event handler noise — just `data-bind="value: value"`
- ✅ Scoped ViewModel binding via `<KnockoutScope>`
- ✅ Single `RootKnockoutProvider` wraps your app
- ✅ TypeScript support with zero-config

---

## 📦 Installation

```bash
npm install react-ko knockout
```

> ⚠️ Requires React 18+ and Knockout 3.5+

---

## 🚀 Usage (JSX / TSX)

> This example works the same in both JavaScript (JSX) and TypeScript (TSX) environments.

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

## 🧩 Component Example

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
import ko from 'knockout'

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

### ▶️ Component Usage

```tsx
import { KoInput } from './KoInput'

const viewModel = {
  name: ko.observable('Alice')
}

<KnockoutScope viewModel={viewModel}>
  <KoInput value={viewModel.name} />
</KnockoutScope>
```

---

## 💡 Why?

```tsx
// Without react-ko (pure React)
<input
  value={value}
  onChange={(e) => setValue(e.target.value)}
  style={{ color }}
/>

// With Knockout binding
<input data-bind="value: value, style: { color: color }" />
```

No more wiring events. Let observables handle your state.

---

## 📁 Folder Structure

```
react-ko/
├── src/
│   ├── RootKnockoutProvider.tsx
│   ├── KnockoutScope.tsx
│   └── context/
│       └── AppViewModelContext.ts
```

---

## 🛠 Development

```bash
npm run build
```

---

## 📄 License

MIT