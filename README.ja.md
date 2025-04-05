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

## ⚡ クイックスタート（スターターテンプレート）

Vite + React + Knockout をベースにした公式スターターを使って、3ステップで始められます：

```bash
npx degit menimani/react-ko-starter my-app
cd my-app
npm install && npm run dev
```

→ [http://localhost:5173](http://localhost:5173) を開いて確認できます。

このテンプレートには以下が含まれています：

- ✅ `react`, `knockout`, `react-ko`
- ✅ TypeScript + Vite + ホットリロード対応
- ✅ 最小限でクリーンなサンプル構成

プロトタイプ、検証、小規模アプリに最適です。

🔗 GitHub: [react-ko-starter](https://github.com/menimani/react-ko-starter)

---

## 🚀 クイック使用例（JSX / TSX）

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

### ▶️ コンポーネント使用例

```tsx
const vm = {
  name: ko.observable('Alice')
}

<KnockoutScope viewModel={vm}>
  <KoInput value={vm.name} />
</KnockoutScope>
```

### ❗ 非推奨コンポーネント

> ⚠️ 以下のコンポーネントは非推奨となり、将来のリリース（v2.0.0）で削除される予定です：
> 
> - KoIfComment
> - KoIfNotComment
> - KoForeachComment
> 
> 代わりに、以下の統一されたコンポーネントを使用してください：
> 
> - ✅ KoIf
> - ✅ KoIfNot
> - ✅ KoForeach
> 
> 新しいコンポーネントは完全に JSX に準拠しており、HTML コメントノードに依存しません。

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
src/
├── components/                          // コンポーネント群
│   ├── scope/                          // Knockoutとの結びつきのための基本コンポーネント
│   │   ├── KnockoutScope.tsx          // KnockoutとReactのスコープを管理
│   │   └── RootKnockoutProvider.tsx   // ルートコンポーネント、Knockoutの初期化
│   ├── structural/                     // Knockoutのフロー制御を担当する汎用コンポーネント
│   │   ├── KoIf.tsx                   // ko if: 制御コンポーネント
│   │   ├── KoIfNot.tsx                // ko ifnot: 制御コンポーネント
│   │   ├── KoForeach.tsx              // ko foreach: 制御コンポーネント
├── context/                             // コンテキスト管理
│   ├── AppViewModelContext.ts          // KnockoutのViewModelに関連するコンテキスト
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