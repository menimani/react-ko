---
layout: default
lang: ja
title: react-ko
description: React コンポーネントの中で Knockout.js を使うための最小のブリッジ
---

# react-ko

[English](../) | 日本語

React コンポーネントの中で Knockout.js を使うための最小のブリッジ。リアクティビティと
`data-bind` は Knockout が持ち、コンポーネント・ツリー・React が描画する要素は React が
持ちます。

- [API の全体](#api-の全体)
- [useKoBind](#usekobind)
- [useKoValue](#usekovalue)
- [KoForeach](#koforeach)
- [KnockoutScope](#knockoutscope)
- [useKoViewModel](#usekoviewmodel)
- [サーバーレンダリングと hydration](#サーバーレンダリングと-hydration)
- [Knockout が所有してよいもの・いけないもの](#knockout-が所有してよいものいけないもの)
- [v2 からの移行](#v2-からの移行)
{: .toc}

---

## インストール

```bash
npm install react-ko knockout
```

`react`（`^18.0.0 || ^19.0.0`）、`react-dom`（`^18.0.0 || ^19.0.0`）、`knockout`
（`^3.5.1`）を peer dependencies として必要とします。パッケージ自体にランタイム依存は
ありません。

---

## API の全体

ランタイムのエクスポートは 5 つ。`KnockoutScope` が通常のスコープを作り、2 つの hook が
スコープと Knockout から値を読み、1 つのコンポーネントがリストを描画し、1 つの hook が
特定の既存要素をバインドします。公開 API は型 `KoBindProps` もエクスポートします。

| エクスポート | 向き | 役割 |
|--------------|------|------|
| `useKoBind` | React → Knockout | 自分が描画した要素をバインディングルートにする |
| `useKoValue` | Knockout → React | observable を React の state として読む |
| `KoForeach` | — | アイテムごとに 1 行を描画し、その行をアイテムにバインドする |
| `KnockoutScope` | — | ViewModel をサブツリーにバインドして提供する |
| `useKoViewModel` | Knockout スコープ → React | 最も近いスコープの ViewModel を読む |
| `KoBindProps` | — | `useKoBind` が返す props の型 |

通常のアプリケーションスコープやネストしたスコープには `KnockoutScope` を使います。
バインディングルートを、ラッパーを置けない特定の要素にする場合は `useKoBind` を使います。

---

## useKoBind

```ts
function useKoBind<T>(viewModel: T | null | undefined): KoBindProps
```

バインディングルートにする必要がある特定の既存要素へ展開する props を返します。通常の
スコープには `KnockoutScope` を使います。

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

その要素の内側にあるすべての `data-bind` が ViewModel に対して適用され、ViewModel の
差し替え時に再適用され、要素が消えるときに `ko.cleanNode` で破棄されます。DOM には何も
追加されないので、タグも属性もマークアップ上の位置も利用側のままです — `select`・`tbody`・
`tr` の下など、ラッパー要素を置けない場所でも同じです。

### nullish な ViewModel は何もバインドしない

hook は条件付きで呼べないため、これにより「条件付きでしか描画されない要素」にも props を
無条件で置けます:

```tsx
const selected = useKoValue(vm.selected)
const bind = useKoBind(selected)

return selected ? <article {...bind} data-bind="text: title" /> : null
```

### 1 回の呼び出しにつき 1 要素

1 回分の props を 2 つの要素に展開した場合は、黙って一方だけをバインドせずエラーとして
報告します。バインディングルートはホストを 1 つしか持たないため、2 つ目が 1 つ目の座を
奪ってしまうからです。

### props の中身

```ts
type KoBindProps = {
  ref: (node: HTMLElement | null) => void
  'data-react-ko-scope': string
}
```

この属性は要素をバインディングルートとして印付けると同時に `useId` の値を運びます。ルートは
これを手がかりに mutation フェーズでホストを見つけ、要素の内側で layout effect が走るより
前にバインドします。props は展開してください。属性を自分で書く必要はありません。

`ref` は `HTMLElement` 型なので、SVG や MathML のルートは実行時ではなく**型エラー**に
なります。

---

## useKoValue

```ts
function useKoValue<T>(source: ko.ObservableArray<T>): T[]
function useKoValue<T>(source: ko.Observable<T> | ko.Computed<T> | T): T
function useKoValue<T>(source: ko.Observable<T> | ko.Computed<T> | T | undefined): T | undefined
```

`data-bind` は Knockout が所有する DOM の振る舞いを扱います。React が描画する値 — JSX
補間、React コンポーネントの props、effect の依存配列 — には値そのものが要ります:

```tsx
function Greeting({ name }: { name: ko.Observable<string> }) {
  const value = useKoValue(name) // string。変化で再描画される
  return <p>Hello, {value}!</p>
}
```

渡すのは observable であって、その値ではありません。`useKoValue(vm.name)` は購読しますが、
`vm.name()` は 1 度読むだけです — 初回は正しい値が出て、その後静かに更新が止まります。

オプショナルなソースは形を保ちます。`ko.Observable<string> | undefined` を渡せば
`string | undefined` が返ります。observable array は `T[]` を返します。配列の値自体が
nullish になり得る場合は、代わりに nullable な observable を使います:

```tsx
const items = ko.observable<Item[] | null | undefined>(undefined)
const value = useKoValue(items) // Item[] | null | undefined
```

素の値はそのまま通過するので、`ko.Observable<T> | T` 型の prop はどちらでも読めます。
Knockout の遅延更新モード（`ko.options.deferUpdates = true`）にも対応しており、値は遅延
通知が走ったときに届きます。

---

## KoForeach

```tsx
<KoForeach items={vm.todos} itemKey={(todo) => todo.id}>
  {(todo, index, bind) => (
    <li {...bind}>
      <span>{index + 1}.</span>
      <input type="checkbox" data-bind="checked: done" />
      <input data-bind="value: title" />
      <button onClick={() => vm.todos.remove(todo)}>Remove</button>
    </li>
  )}
</KoForeach>
```

hook ではなくコンポーネントである理由は 1 つ — **hook はループ内で呼べない**のに、各行には
それぞれのバインディングルートが要るからです。render prop はそのルートを第 3 引数として
受け取ります。

行に `data-bind` があるときに `KoForeach` を使います。なければ、リストは通常の React です:

```tsx
const items = useKoValue(vm.items)

return items.map((item) => <Row key={item.id} item={item} />)
```

この場合は通常の React の key を使います。`KoForeach` が追加するのは行ごとの Knockout
バインディングルートだけなので、バインドしないリストには何も付け加えません。

- `items` は可変・読み取り専用の配列に加え、observable・computed も受け付けます。値が
  `null` や `undefined` のときは空のリストになります。
- バインドする行の周囲には DOM が何も追加されないので、`select`・`tbody`・`tr` でも特別な
  扱いは要りません。
- `$data` / `$index` / `$parent` の代わりに、引数とクロージャを使います。外側の変数は
  そのまま見え、行の中に React コンポーネントを置けます。
- 行のキーは `itemKey` があればそれを使います。なければオブジェクトは同一性と出現順（同じ
  参照が複数あっても一意）、プリミティブは index にフォールバックします — 行が状態を持ち
  アイテムがプリミティブな場合は `itemKey` を渡してください。

条件分岐にコンポーネントは要りません。値は `useKoValue` が既に返しているからです:

```tsx
const visible = useKoValue(vm.visible)

return visible ? <section {...bind}>…</section> : null
```

---

## KnockoutScope

```tsx
<KnockoutScope viewModel={vm}>
  <LazyPanel />
</KnockoutScope>
```

`useKoBind` は印を付けたホストを mutation フェーズで見つけ、子孫の layout effect より前に
バインドします。最初のバインディング処理より後に追加された子孫も監視します。

`KnockoutScope` は通常のスコープ API です。サブツリーをバインドし、React コンポーネントへ
`useKoViewModel` を通じて ViewModel を提供します。ツリー上にコンポーネント所有の位置を持ち、
ホストの前に不活性なマーカーを描画するため、ViewModel の差し替えと同じコミットで子や portal
が追加・再バインドされても、その子や portal が監視される前に差し替えを通知できます。

ホストは `display: contents` を付けた素の `div` で、選ぶことはできません。`option`・`tr`・
`li` など別の要素でなければならない場合は、`useKoBind` で利用側の要素を使ってください。

---

## useKoViewModel

```ts
function useKoViewModel<T>(): T
```

最も近い `KnockoutScope` の ViewModel を返します:

```tsx
import { KnockoutScope, useKoViewModel } from 'react-ko'

function Panel() {
  const vm = useKoViewModel<AppViewModel>()
  return <button data-bind="click: save">Save {vm.title}</button>
}

function App() {
  return (
    <KnockoutScope viewModel={new AppViewModel()}>
      <Panel />
    </KnockoutScope>
  )
}
```

型引数にはアプリケーションの ViewModel 型を指定します。React context の境界を越えて型を
推論することはできません。`KnockoutScope` の外で呼ぶとエラーになります。`T` に含まれて
いれば `null` と `undefined` も有効なスコープ値で、ネスト時には最も近い ViewModel を返します。

---

## サーバーレンダリングと hydration

`useKoBind` のルートは、サーバーでは自前の要素を追加せずに描画されます。ref はサーバーで
走らないのでバインディングも適用されず、出力されるマークアップは利用側が書いたものに
バインディングルート属性が付いただけです。hydration はそれらの要素を再利用し、後から
バインディングを取り付けます。そのため、サーバーが描画した `select` の直下には `option`
しかなく、hydration がそれらを置き換えることもありません。一方 `KnockoutScope` は、渡された
children に加え、`display: contents` の 2 つのホストとコミットマーカーもサーバーで描画します。
DOM のバインディングは hydration まで待ちますが、ViewModel はサーバーレンダリング中にも
`useKoViewModel` から取得できます。

dehydrated な Suspense 境界の内側のバインディングは、境界が解決するまで保留されます。

---

## Knockout が所有してよいもの・いけないもの

ライブラリが Knockout に渡す要素の所有者は、常に React です。React が空にしておいた要素の
**内容**は Knockout が所有できます（`text`・`html`・`component`・`options`）。しかし React が
描画した children を制御してしまうバインディングは、同じノードを取り合わせるのではなく、
バインディング名を挙げたエラーとして拒否されます。

バインディングは `data-bind` が変わったときや要素が消えるときに retire され、それが残した
DOM への副作用 — 属性・クラス・インラインスタイル・フォーカス・checked / disabled 状態・
radio の暗黙の name — は復元されます。

---

## v2 からの移行

| v2 | v3 |
|----|----|
| `<RootKnockoutProvider viewModel={vm}>…</RootKnockoutProvider>` | `<KnockoutScope viewModel={vm}>…</KnockoutScope>` |
| `<KnockoutScope viewModel={vm}>…</KnockoutScope>` | 変更なし。`useKoViewModel` に `vm` も提供するようになった |
| `<KoIf condition={c}>…</KoIf>` | `useKoValue(c) ? … : null` |
| `<KoIfNot condition={c}>…</KoIfNot>` | `useKoValue(c) ? null : …` |
| `<KoWith value={v}>{(x) => …}</KoWith>` | `const x = useKoValue(v); const bind = useKoBind(x)` の後 `x ? <div {...bind}>…</div> : null` |
| `<KoForeach>{(item, i) => …}</KoForeach>` | `<KoForeach>{(item, i, bind) => …}</KoForeach>` |
| `boundaryAs`・`as`・`bindingMode` | 廃止。要素が利用側のものなら、そのタグも利用側のもの |
| `SemanticHost`・`SemanticHostProps` | 上記と一緒に廃止 |
| `createAppViewModelContext`・`useAppViewModel`・`AppViewModelContext` | `KnockoutScope` 内の `useKoViewModel<T>()` |
| `KoScope` | 廃止。名前は `KnockoutScope` |

`useKoValue` は変更ありません。

---

[GitHub のソース](https://github.com/menimani/react-ko) ·
[npm](https://www.npmjs.com/package/react-ko)
