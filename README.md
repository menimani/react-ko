# react-ko

> 🧠 A minimal bridge library to use Knockout.js inside React components.  
> Combine Knockout's reactivity with React's component architecture.

---

## ✨ Features

- ✅ Seamless integration between React and Knockout
- ✅ Two-way binding with Knockout observables
- ✅ `with:` scoping via `KnockoutScope`
- ✅ Use Knockout ViewModels with JSX components
- ✅ TypeScript supported

---

## 📦 Installation

```bash
npm install react-ko knockout
```

> ⚠️ React 18+ / Knockout 3.5+ is required.

---

## 🚀 Usage

```tsx
import { RootKnockoutProvider, KnockoutScope } from 'react-ko'
```

### 1. Setup Root ViewModel

```tsx
const viewModel = {
  value: ko.observable('Hello KO'),
}
```

### 2. Wrap with `<RootKnockoutProvider>`

```tsx
<RootKnockoutProvider viewModel={viewModel}>
  <App />
</RootKnockoutProvider>
```

---

### 3. Use KnockoutScope in children

```tsx
<KnockoutScope vm={viewModel}>
  <input data-bind="value: value" />
</KnockoutScope>
```

---

## 🧩 Component Example

```tsx
export function KoInput({ value }) {
  const vm = { value }

  return (
    <KnockoutScope vm={vm}>
      <input data-bind="value: value" />
    </KnockoutScope>
  )
}
```

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

## 🧠 Philosophy

React excels at components.  
Knockout excels at bindings and observables.  
**react-ko lets them work together without compromise.**

---

## 🛠 Development

```bash
npm run build
```

---

## 📄 License

MIT