# react-ko

[en English](./README.md) | ja 日本語

[![npm version](https://img.shields.io/npm/v/react-ko)](https://www.npmjs.com/package/react-ko)

> 🧠 Knockout.js を React コンポーネント内で使うための最小限のブリッジライブラリ  
> Knockout のリアクティブ性と React のコンポーネント構造をクリーンに融合します

---

## ✨ 特長

- ✅ Knockout の observable による双方向データバインディング
- ✅ JSX / TSX 上でそのまま `data-bind="..."` を使用可能
- ✅ `<KnockoutScope>` によるスコープ付き ViewModel
- ✅ `<RootKnockoutProvider>` による1行ルートバインディング
- ✅ イベントハンドラや状態管理のボイラープレート不要
- ✅ TypeScript / JavaScript の両対応（設定不要）
- ✅ Knockout と React 以外のランタイム依存なし

---

## 📦 インストール

```bash
npm install react-ko knockout
```

> ⚠️ このライブラリは `react` (v18+) と `knockout` (v3.5+) をピア依存としています。

---

## 🚀 クイック使用例（JSX / TSX）

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

## 🧩 カスタムコンポーネント例

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

### ▶️ コンポーネント使用例

```tsx
const vm = {
  name: ko.observable('Alice')
}

<KnockoutScope viewModel={vm}>
  <KoInput value={vm.name} />
</KnockoutScope>
```

---

## 🤔 なぜ react-ko？

従来の React：

```tsx
<input
  value={value}
  onChange={(e) => setValue(e.target.value)}
  style={{ color }}
/>
```

react-ko を使うと：

```tsx
<input data-bind="value: value, style: { color: color }" />
```

イベントや状態管理の記述は不要。  
Knockout の observable に任せるだけで、UI がリアクティブに更新されます。

---

## 📁 フォルダ構成

```
react-ko/
├── src/
│   ├── RootKnockoutProvider.tsx
│   ├── KnockoutScope.tsx
│   └── context/
│       └── AppViewModelContext.ts
```

---

## 🛠 開発

```bash
npm install
npm run build
```

---

## 📄 ライセンス

MIT