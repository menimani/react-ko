# react-ko

[en English](./README.md) | ja 日本語

[![npm version](https://img.shields.io/npm/v/react-ko)](https://www.npmjs.com/package/react-ko)

> React コンポーネントの中で Knockout.js を使うための最小のブリッジ。Knockout のリアクティビティと React のコンポーネント設計を、素直に・スコープを保って・型安全に組み合わせます。

**[ドキュメント](https://menimani.github.io/react-ko/ja/)** — API の全体、サーバー
レンダリング、v2 からの移行。

---

## インストール

```bash
npm install react-ko knockout
```

> `react`（`^18.0.0 || ^19.0.0`）、`react-dom`（`^18.0.0 || ^19.0.0`）、`knockout`（`^3.5.1`）を peer dependencies として必要とします。パッケージ自体にランタイム依存はありません。

---

## 1 つの例で

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
      <p>{count} items（React が描画）</p>
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

`KnockoutScope` はスコープを作る通常の方法です。内側のサポートされている `data-bind` が
ViewModel に対して適用され、スコープ内のどの React コンポーネントからでも
`useKoViewModel` でその ViewModel を取得できます。ネストしたスコープは、それぞれの
ViewModel を提供します。Knockout は React がレンダーした子孫の所有権を引き継げないため、
構造を制御する `if`、`ifnot`、`foreach`、`template`、`with` バインディングは拒否されます。
その構造は React と `useKoValue` でレンダーするか、リストには `KoForeach` を使用してください。
`text`、`html`、`component`、`options` など要素の内容を置き換えるバインディングでは、内容を
Knockout だけが所有できるように、JSX で空のホスト要素を指定する必要があります。
`useKoValue` は
`data-bind` が届かない場所 — JSX 補間・props・effect の依存配列 — に Knockout の値を
持ち込みます。

リストの行に `data-bind` がなければ、それは通常の React のリストです。
`useKoValue(vm.items)` で読み、通常の React の key を付けて `.map(...)` してください。
`KoForeach` が追加するのは行ごとの Knockout バインディングルートだけなので、この場合は何も
付け加えません。

ランタイムのエクスポートは 5 つ：`KnockoutScope`、`useKoViewModel`、`useKoValue`、リスト用の
`KoForeach`、そしてラッパーを使えないときに特定の既存要素をバインディングルートにする
`useKoBind`。React の insertion phase で検出できないホストは拒否されます。これには closed shadow root 内、
`DocumentFragment` などの切り離されたツリー内、ページから到達できない別の `Document` 内のホストが
含まれます。これらのレンダー位置では `KnockoutScope` を使ってください。アクセス可能な同一オリジンの
iframe 内のホストはサポートされます。TypeScript では、
`useKoBind` が返す型 `KoBindProps` もインポートできます。詳細は
[ドキュメント](https://menimani.github.io/react-ko/ja/)にあります。

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

ドキュメントサイトは `docs/` ディレクトリで、GitHub Pages が公開します。このリポジトリを
保守する自律改善ループは `orchestration/` にあります。実行と再開の方法は
`orchestration/CLAUDE.md` を参照してください。

---

## ライセンス

MIT
