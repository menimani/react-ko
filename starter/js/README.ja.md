# react-ko Bookshelf スターター（JavaScript）

[en English](./README.md) | ja 日本語

[react-ko](https://github.com/menimani/react-ko)（React と Knockout.js の最小限の
ブリッジライブラリ）の公式 JavaScript スターターです。同梱の Bookshelf アプリは、
本の追加・編集・削除・絞り込み、リアルタイム集計、ローカル保存を備えた小さな読書記録です。

## クイックスタート

```bash
npx degit menimani/react-ko/starter/js my-bookshelf
cd my-bookshelf
npm install
npm run dev
```

TypeScript 版は `starter/ts` を使ってください。

## サンプルの構成

- [`src/appViewModel.js`](./src/appViewModel.js) は Knockout の `observableArray` として
  本棚を所有し、双方向フォーム、ステータス絞り込み、算出した集計、`localStorage`
  への永続化も管理します。
- [`src/main.jsx`](./src/main.jsx) は ViewModel を `KnockoutScope` に渡し、コンポーネント
  ツリーへの提供とバインディングの適用を行います。
- [`src/App.jsx`](./src/App.jsx) は `useKoViewModel` で ViewModel を取得し、本棚の
  3 つの主要セクションを組み合わせます。
- [`src/components`](./src/components) には、集計を扱う `ShelfSummary`、追加と編集を
  扱う `BookForm`、キー付きリストを描画する `BookList`、1 冊を表す `BookRow`、
  絞り込みチップを扱う `StatusFilter` の 5 つの小さなコンポーネントがあります。
  各コンポーネントは props で ViewModel または 1 冊の本を受け取り、`useKoBind`
  または `KoForeach` でバインディングルートを確立します。

フォームはフィールドを React state に複製せず、双方向の `value` バインディングを
利用します。本を追加または編集すると、Knockout の算出集計と絞り込み済みの
`KoForeach` がすぐ更新されます。永続化用の computed も各本の observable を読むため、
変更内容は再読み込み後も残ります。

```jsx
const vm = useKoViewModel()

<form data-bind="submit: saveBook">
  <input data-bind="value: draftTitle, valueUpdate: 'input'" />
</form>
<KoForeach items={vm.filteredBooks} itemKey={(book) => book.id}>
  {(_book, _index, bind) => (
    <li {...bind}><span data-bind="text: title" /></li>
  )}
</KoForeach>
```

完全な API は [react-ko の README](https://github.com/menimani/react-ko/blob/main/README.ja.md)
を参照してください。

## ライセンス

MIT
