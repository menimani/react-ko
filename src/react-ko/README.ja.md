# react-ko

[en English](./README.md) | ja 日本語

[![npm version](https://img.shields.io/npm/v/react-ko)](https://www.npmjs.com/package/react-ko)

> React コンポーネントの中で Knockout.js を使うための最小のブリッジ。Knockout のリアクティビティと React のコンポーネント設計を、素直に・スコープを保って・型安全に組み合わせます。

---

## 特長

- Knockout の observable による双方向データバインディング
- JSX / TSX の中で `data-bind="..."` をそのまま書ける
- `useKoBind` は自分が描画した要素をバインディングルートにする。DOM には何も追加しない
- `useKoValue` で observable を React の state として読める
- `<KoForeach>` の render prop による型安全なリスト描画
- `data-bind` で扱う DOM の振る舞いには、React のイベントハンドラやローカル state のボイラープレート不要
- TypeScript / JavaScript の両対応（設定不要）
- Knockout・React・React DOM 以外のランタイム依存なし

---

## インストール

```bash
npm install react-ko knockout
```

> `react`（`^18.0.0 || ^19.0.0`）、`react-dom`（`^18.0.0 || ^19.0.0`）、`knockout`（`^3.5.1`）を peer dependencies として必要とします。

---

## スターターテンプレートで始める

### TypeScript

```bash
npx degit menimani/react-ko/starter/ts my-app-ts
cd my-app-ts
npm install && npm run dev
```

テンプレート: [`starter/ts`](https://github.com/menimani/react-ko/tree/main/starter/ts)

### JavaScript

```bash
npx degit menimani/react-ko/starter/js my-app-js
cd my-app-js
npm install && npm run dev
```

テンプレート: [`starter/js`](https://github.com/menimani/react-ko/tree/main/starter/js)

---

## API の全体

エクスポートは 4 つ。うち 2 つがブリッジ、1 つがリスト、1 つはブリッジで賄えない場合のためのものです。

| エクスポート | 役割 |
|--------------|------|
| `useKoBind` | React → Knockout。自分が描画した要素をバインディングルートにする |
| `useKoValue` | Knockout → React。observable を React の state として読む |
| `KoForeach` | アイテムごとに 1 行を描画し、その行をアイテムにバインドする |
| `KnockoutScope` | 自前のホストを描画するスコープ。子が後から現れる場合向け |

---

## 基本的な使い方（JSX / TSX）

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

`useKoBind` は、既にある要素に展開するための props を返します。その要素がバインディング
ルートになり、内側のすべての `data-bind` が ViewModel に対して適用され、ViewModel の
差し替え時には再適用され、要素が消えるときに `ko.cleanNode` で破棄されます。DOM には
何も追加されないので、タグも属性もマークアップ上の位置も利用側のままです — `select` や
`tbody` のようにラッパーを置けない場所でも同じです。

nullish な ViewModel は何もバインドしません。これにより、条件付きでしか描画されない要素にも
props を無条件で置けます:

```tsx
const selected = useKoValue(vm.selected)
const bind = useKoBind(selected)

return selected ? <article {...bind} data-bind="text: title" /> : null
```

`useKoBind` は 1 要素につき 1 回呼びます。1 回分の props を 2 つの要素に展開した場合は、
黙って一方だけをバインドせずエラーとして報告します。

---

## React 側で値を読む: `useKoValue`

`data-bind` が扱えるのは DOM 属性になるものだけです。それ以外 — JSX 補間、React
コンポーネントの props、effect の依存配列 — には値そのものが要ります:

```tsx
import { useKoValue } from 'react-ko'

function Greeting({ name }: { name: ko.Observable<string> }) {
  const value = useKoValue(name) // string。変化で再描画される
  return <p>Hello, {value}!</p>
}
```

渡すのは observable であって、その値ではありません。`useKoValue(vm.name)` は購読しますが、
`vm.name()` は 1 度読むだけで以後更新されません。

オプショナルなソースは形を保ちます。`ko.Observable<string> | undefined` を渡せば
`string | undefined` が返ります。observable array は `T[] | null | undefined` を返します —
実行時に実際そうなり得るからです。空配列にフォールバックしたい場合は呼び出し側で守ります:

```tsx
const items = useKoValue(vm.items) ?? []
```

Knockout の遅延更新モード（`ko.options.deferUpdates = true`）にも対応しています。値は
遅延通知が走ったときに届きます。

---

## リスト: `KoForeach`

`KoForeach` は render prop をアイテムごとに 1 回呼び、そのアイテムに対するバインディング
ルートを渡します。行自身の要素に展開してください:

```tsx
import ko from 'knockout'
import { KoForeach, useKoBind } from 'react-ko'

type Todo = {
  title: ko.Observable<string>
  done: ko.Observable<boolean>
}

const vm = { todos: ko.observableArray<Todo>([]) }

function Todos() {
  const bind = useKoBind(vm)

  return (
    <ul {...bind}>
      <KoForeach items={vm.todos}>
        {(todo, index, rowBind) => (
          <li {...rowBind}>
            <span>{index + 1}.</span>
            <input type="checkbox" data-bind="checked: done" />
            <input data-bind="value: title" />
            <button onClick={() => vm.todos.remove(todo)}>Remove</button>
          </li>
        )}
      </KoForeach>
    </ul>
  )
}
```

- `items` は可変・読み取り専用の配列に加え、observable や computed も受け付けます。配列値が
  `null` や `undefined` のときは空のリストになります。
- バインドしない行は第 3 引数を無視できます。どちらの場合も DOM には何も追加されないので、
  `select`・`tbody`・`tr` でも特別な扱いは要りません。
- `$data` / `$index` / `$parent` の代わりに、関数引数とクロージャを使います。外側の変数は
  そのまま見え、行の中に React コンポーネントを置けます。
- 行のキーは `itemKey` があればそれを使い、なければオブジェクトは同一性と出現順（同じ参照が
  複数あっても一意になります）、プリミティブは index にフォールバックします。行が状態を持ち
  アイテムがプリミティブな場合は `itemKey` を渡してください。

条件分岐は普通の React です。値は `useKoValue` が既に返しているからです:

```tsx
const visible = useKoValue(vm.visible)

return visible ? <section {...bind}>…</section> : null
```

---

## 後から現れる子: `KnockoutScope`

`useKoBind` は渡された要素を ref 経由でバインドします。React は ref を子から順に attach し、
コンポーネント自身の effect は子孫の後に走るため、ref から取ったルートは自分のサブツリーを
最後に知ることになります。ほとんどの場面では見えませんが、2 つの場合に効いてきます — 初回
コミットで子孫の layout effect が Knockout 所有の DOM に書き込む場合と、子が現れるのと同じ
コミットで ViewModel が差し替わる場合です。

`KnockoutScope` はホストの前に不活性なマーカーを描画します。最初の子の ref と effect は
兄弟より先に走るので、これらの場合も正しくバインドできます:

```tsx
import { KnockoutScope } from 'react-ko'

<KnockoutScope viewModel={vm}>
  <LazyPanel />
</KnockoutScope>
```

ホストは `display: contents` を付けた素の `div` です。それ以外の要素にしたい場合は、
`useKoBind` で利用側の要素を使ってください。

---

## ViewModel をサブツリーに配る

これは普通の React なので、react-ko は提供しません:

```tsx
import { createContext, useContext } from 'react'

const AppViewModelContext = createContext<AppViewModel | null>(null)

export function useAppViewModel() {
  const viewModel = useContext(AppViewModelContext)
  if (viewModel === null) throw new Error('Missing provider')
  return viewModel
}
```

スターターに実例があります。

---

## v2 からの移行

v3 はスコープコンポーネントを hook に置き換えます。原則は 1 つ — これまでコンポーネントが
ホストを描画していた場所では、バインドしたい要素に `useKoBind` を展開します。

| v2 | v3 |
|----|----|
| `<RootKnockoutProvider viewModel={vm}>…</RootKnockoutProvider>` | `<div {...useKoBind(vm)}>…</div>` |
| `<KnockoutScope viewModel={vm}>…</KnockoutScope>` | `<div {...useKoBind(vm)}>…</div>`。後から現れる子がある場合は `KnockoutScope` のまま |
| `<KoIf condition={c}>…</KoIf>` | `useKoValue(c) ? … : null` |
| `<KoIfNot condition={c}>…</KoIfNot>` | `useKoValue(c) ? null : …` |
| `<KoWith value={v}>{(x) => …}</KoWith>` | `const x = useKoValue(v)` の後 `x ? <div {...useKoBind(x)}>…</div> : null` |
| `<KoForeach>{(item, i) => …}</KoForeach>` | `<KoForeach>{(item, i, bind) => …}</KoForeach>` |
| `boundaryAs` / `as` / `bindingMode` | 廃止。要素が利用側のものなら、そのタグも利用側のもの |
| `SemanticHost`、`SemanticHostProps` | 上記と一緒に廃止 |
| `createAppViewModelContext`、`useAppViewModel`、`AppViewModelContext` | 上記のとおり、素の React context |

`useKoValue` は変更ありません。

---

## なぜ react-ko？

react-ko なし（素の React）:

```tsx
<input
  value={value}
  onChange={(e) => setValue(e.target.value)}
  style={{ color }}
/>
```

react-ko あり:

```tsx
<input data-bind="value: value, style: { color: color }" />
```

`data-bind` で扱う DOM の振る舞いについては、React のイベント配線もローカル state の管理も
要りません。モダンな React の中でも、Knockout の observable に仕事をさせられます。

---

## 開発

```bash
npm install
npm run build
```

クローンごとに 1 度、リポジトリのフックを有効にしてください:

```bash
git config core.hooksPath .githooks
```

スターターは npm workspace です。ルートで install すれば、publish せずにローカルの
ライブラリに対して動きます。

```bash
npm run dev --workspace=starter/ts
```

このリポジトリを保守する自律改善ループは `orchestration/` にあります。実行と再開の方法は
`orchestration/CLAUDE.md` を参照してください。

---

## ライセンス

MIT
