---
layout: default
lang: ja
title: react-ko
description: React コンポーネントの中で Knockout.js を使うための最小のブリッジ
---

# react-ko

[English](../) | 日本語

React コンポーネントの中で Knockout.js を使うための最小のブリッジ。リアクティビティと
`data-bind` は Knockout が持ち、コンポーネント・ツリー・その中のすべての要素は React が
持ちます。

- [API の全体](#api-の全体)
- [useKoBind](#usekobind)
- [useKoValue](#usekovalue)
- [KoForeach](#koforeach)
- [KnockoutScope](#knockoutscope)
- [ViewModel をサブツリーに配る](#viewmodel-をサブツリーに配る)
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

エクスポートは 4 つ。2 つが 2 つのライブラリを橋渡しし、1 つがリスト、1 つは橋渡しでは
賄えない場合を受け持ちます。

| エクスポート | 向き | 役割 |
|--------------|------|------|
| `useKoBind` | React → Knockout | 自分が描画した要素をバインディングルートにする |
| `useKoValue` | Knockout → React | observable を React の state として読む |
| `KoForeach` | — | アイテムごとに 1 行を描画し、その行をアイテムにバインドする |
| `KnockoutScope` | — | 自前のホストを描画するスコープ。子が後から現れる場合向け |

API が従っている原則は 1 つ — **ライブラリは利用側が書けないものだけを持ち、要素は利用側の
もの**。

---

## useKoBind

```ts
function useKoBind<T>(viewModel: T | null | undefined): KoBindProps
```

バインディングルートにしたい要素へ展開するための props を返します。

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
function useKoValue<T>(source: ko.ObservableArray<T>): T[] | null | undefined
function useKoValue<T>(source: ko.Observable<T> | ko.Computed<T> | T): T
function useKoValue<T>(source: ko.Observable<T> | ko.Computed<T> | T | undefined): T | undefined
```

`data-bind` が扱えるのは DOM 属性になるものだけです。それ以外 — JSX 補間、React
コンポーネントの props、effect の依存配列 — には値そのものが要ります:

```tsx
function Greeting({ name }: { name: ko.Observable<string> }) {
  const value = useKoValue(name) // string。変化で再描画される
  return <p>Hello, {value}!</p>
}
```

渡すのは observable であって、その値ではありません。`useKoValue(vm.name)` は購読しますが、
`vm.name()` は 1 度読むだけです — 初回は正しい値が出て、その後静かに更新が止まります。

オプショナルなソースは形を保ちます。`ko.Observable<string> | undefined` を渡せば
`string | undefined` が返ります。observable array は `T[] | null | undefined` を返します。
実行時に実際そうなり得るからです:

```tsx
const items = useKoValue(vm.items) ?? []
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

- `items` は可変・読み取り専用の配列に加え、observable・computed も受け付けます。値が
  `null` や `undefined` のときは空のリストになります。
- バインドしない行は第 3 引数を無視できます。どちらの場合も DOM には何も追加されないので、
  `select`・`tbody`・`tr` でも特別な扱いは要りません。
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

`useKoBind` は渡された要素を ref 経由でバインドします。React は ref を子から順に attach し、
コンポーネント自身の effect は子孫の後に走るため、ref から取ったルートは自分のサブツリーを
最後に知ります。ほとんどのツリーでは見えませんが、2 つの場合に効いてきます:

- 初回コミットで、子孫の layout effect が Knockout 所有の DOM に書き込む場合
  （input に値を入れてイベントを発火する、など）
- 子が現れるのと同じコミットで ViewModel が差し替わる場合

`KnockoutScope` はホストの前に不活性なマーカーを描画します。最初の子の ref と effect は
兄弟より先に走るので、この位置が上記を正しくバインドします。hook にはこの位置がありません。

ホストは `display: contents` を付けた素の `div` で、選ぶことはできません。それ以外の要素に
したい場合は `useKoBind` で利用側の要素を使ってください。

---

## ViewModel をサブツリーに配る

これは普通の React なので、ライブラリは提供しません:

```tsx
import { createContext, useContext } from 'react'

const AppViewModelContext = createContext<AppViewModel | null>(null)

export function useAppViewModel() {
  const viewModel = useContext(AppViewModelContext)
  if (viewModel === null) throw new Error('Missing provider')
  return viewModel
}
```

両方のスターターに、ルートのバインドと並べた実例があります。

---

## サーバーレンダリングと hydration

バインディングルートはサーバーでは children をそのまま描画し、自分では何も足しません。ref は
サーバーで走らないのでバインディングも適用されず、出力されるマークアップは利用側が書いた
ものにバインディングルート属性が付いただけです。hydration はそれらの要素を再利用し、後から
バインディングを取り付けます。そのため、サーバーが描画した `select` の直下には `option`
しかなく、hydration がそれらを置き換えることもありません。

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
| `<RootKnockoutProvider viewModel={vm}>…</RootKnockoutProvider>` | `<div {...useKoBind(vm)}>…</div>` |
| `<KnockoutScope viewModel={vm}>…</KnockoutScope>` | `<div {...useKoBind(vm)}>…</div>`。後から現れる子がある場合は `KnockoutScope` のまま |
| `<KoIf condition={c}>…</KoIf>` | `useKoValue(c) ? … : null` |
| `<KoIfNot condition={c}>…</KoIfNot>` | `useKoValue(c) ? null : …` |
| `<KoWith value={v}>{(x) => …}</KoWith>` | `const x = useKoValue(v)` の後 `x ? <div {...useKoBind(x)}>…</div> : null` |
| `<KoForeach>{(item, i) => …}</KoForeach>` | `<KoForeach>{(item, i, bind) => …}</KoForeach>` |
| `boundaryAs`・`as`・`bindingMode` | 廃止。要素が利用側のものなら、そのタグも利用側のもの |
| `SemanticHost`・`SemanticHostProps` | 上記と一緒に廃止 |
| `createAppViewModelContext`・`useAppViewModel`・`AppViewModelContext` | 素の React context |
| `KoScope` | 廃止。名前は `KnockoutScope` |

`useKoValue` は変更ありません。

---

[GitHub のソース](https://github.com/menimani/react-ko) ·
[npm](https://www.npmjs.com/package/react-ko)
