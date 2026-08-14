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
import { useKoBind, useKoValue } from 'react-ko'

const vm = {
  name: ko.observable('Knockout'),
  items: ko.observableArray<string>([]),
}

function Greeting() {
  const bind = useKoBind(vm)
  const count = (useKoValue(vm.items) ?? []).length

  return (
    <section {...bind}>
      <input data-bind="value: name, valueUpdate: 'input'" />
      <p data-bind="text: name" />
      <p>{count} items（React が描画）</p>
    </section>
  )
}
```

`useKoBind` は、既に描画した要素をバインディングルートにします。その内側のすべての
`data-bind` が ViewModel に対して適用され、DOM には何も追加されません。`useKoValue` は
`data-bind` が届かない場所 — JSX 補間・props・effect の依存配列 — に Knockout の値を
持ち込みます。

エクスポートは 4 つ：`useKoBind`、`useKoValue`、リスト用の `KoForeach`、そしてスコープが
バインドした後に現れる子のための `KnockoutScope`。詳細は
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
