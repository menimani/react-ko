# react-ko

[en English](./README.md) | ja 日本語

[![npm version](https://img.shields.io/npm/v/react-ko)](https://www.npmjs.com/package/react-ko)

> Knockout.js を React コンポーネント内で使うための最小限のブリッジライブラリ。Knockout のリアクティブ性と React のコンポーネント構造をクリーンに融合します

---

## 特長

- Knockout の observable による双方向データバインディング
- JSX / TSX 上でそのまま `data-bind="..."` を使用可能
- `<KnockoutScope>` によるスコープ付き ViewModel
- `<RootKnockoutProvider>` による1行ルートバインディング
- `<KoForeach>` の render prop による型安全なリスト描画
- observable を React の state として読める `useKoValue`
- イベントハンドラや状態管理のボイラープレート不要
- TypeScript / JavaScript の両対応（設定不要）
- Knockout と React 以外のランタイム依存なし

---

## インストール

```bash
npm install react-ko knockout
```

> このライブラリは `react` (`^18.0.0 || ^19.0.0`)、`react-dom` (`^18.0.0 || ^19.0.0`)、`knockout` (`^3.5.1`) をピア依存としています。

---

## クイックスタート（スターターテンプレート）

### TypeScript

```bash
npx degit menimani/react-ko/starter/ts my-app-ts
cd my-app-ts
npm install && npm run dev
```

テンプレート: [`starter/ts`](./starter/ts)

---

### JavaScript

```bash
npx degit menimani/react-ko/starter/js my-app-js
cd my-app-js
npm install && npm run dev
```

テンプレート: [`starter/js`](./starter/js)

---

## クイック使用例（JSX / TSX）

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

## カスタムコンポーネント例

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

### コンポーネント使用例

```tsx
const vm = {
  name: ko.observable('Alice')
}

<KnockoutScope viewModel={vm}>
  <KoInput value={vm.name} />
</KnockoutScope>
```

---

## 構造コンポーネント

### `KoForeach`

`KoForeach` は render prop を取ります。関数は各アイテムとそのインデックスを
受け取り、返した JSX はそのアイテムにバインドされます — 行内の `data-bind`
は行アイテムを直接参照できます。

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
      <button onClick={() => vm.todos.remove(todo)}>削除</button>
    </li>
  )}
</KoForeach>
```

- `items` は `ko.ObservableArray<T>`、`ko.Observable<T[]>`、
  `ko.Computed<T[]>`、素の `T[]` を受け付けます。
- `$data` / `$index` / `$parent` の代わりに、関数引数とクロージャを
  使います — 外側の変数（上の例の `vm`）はそのまま見え、行の中に React
  コンポーネントを置けます。
- 行のキーは `itemKey` があればそれを使い、なければオブジェクトは同一性
  ベース、プリミティブは index にフォールバックします。行が状態を持ち
  アイテムがプリミティブな場合は `itemKey` を渡してください。

ネストは普通の JSX として書けます：

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

条件が true（`KoIf`）または false（`KoIfNot`）の間だけ children を描画
します。children 内の `data-bind` は外側スコープの ViewModel を参照します。

```tsx
<KoIf condition={vm.isVisible}>
  <p data-bind="text: message" />
</KoIf>
```

---

## useAppViewModel

`useAppViewModel<T>()` は現在のアプリケーション ViewModel を取得します。このフックは
`AppViewModelContext.Provider` の配下で使用する必要があります。`RootKnockoutProvider` は
内部でこのコンテキストプロバイダーを提供しますが、利用側で
`AppViewModelContext.Provider` を直接提供することもできます。

---

## useKoValue

Knockout の observable / computed / 素の値を React の state として読み
ます。現在値を返し、変更されるとコンポーネントを再レンダーします。
Knockout の値を React の世界（JSX の補間、effect の依存配列、props への
受け渡し）へ持ち込む唯一の正規ルートです。

```tsx
import { useKoValue } from 'react-ko'

function Greeting({ name }: { name: ko.Observable<string> }) {
  const value = useKoValue(name) // string 型、変更で再レンダー
  return <p>Hello, {value}!</p>
}
```

---

## v1 からの移行

v2 には破壊的変更が含まれます：

- **`KoForeach` の children が関数になりました** `(item, index) => ReactNode`。
  v1 の形式（素の JSX を Knockout の `foreach:` に委譲）は廃止です —
  React が所有する DOM を Knockout が複製する構造だったためです。
- **`KoIfComment` / `KoIfNotComment` / `KoForeachComment` は予告どおり
  削除されました。** `KoIf` / `KoIfNot` / `KoForeach` を使ってください。
- **各 `KnockoutScope` が独立したバインディングルートになりました。**
  スコープ内の `$root` はそのスコープ自身の ViewModel を指し、`$parent`
  はスコープ境界を越えません。props とクロージャを使ってください。
- **`KoIf` / `KoIfNot` の children 内の `data-bind`** は外側スコープの
  ViewModel に対して解決されるようになりました（以前は condition を
  保持する内部ラッパーオブジェクトを参照していました）。

---

## なぜ react-ko？

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

## 開発

```bash
npm install
npm run build
```

---

## ライセンス

MIT
