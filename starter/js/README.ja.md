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
- [`src/App.jsx`](./src/App.jsx) はマークアップを所有します。`useKoViewModel` で
  ViewModel を取得し、`data-bind` でコントロールをバインドし、キー付きの本の行を
  `KoForeach` で描画するため、コンポーネントツリーの管理は React が担当します。

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
