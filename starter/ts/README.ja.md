# react-ko Bookshelf スターター（TypeScript）

[en English](./README.md) | ja 日本語

[react-ko](https://github.com/menimani/react-ko)（React と Knockout.js の最小限の
ブリッジライブラリ）の公式 TypeScript スターターです。同梱の Bookshelf アプリは、
本の追加・編集・削除・絞り込み、リアルタイム集計、ローカル保存を備えた小さな読書記録です。

## クイックスタート

```bash
npx degit menimani/react-ko/starter/ts my-bookshelf
cd my-bookshelf
npm install
npm run dev
```

JavaScript 版は `starter/js` を使ってください。

## サンプルの構成

- [`src/appViewModel.ts`](./src/appViewModel.ts) は Knockout の `observableArray` として
  本棚を所有し、双方向フォーム、ステータス絞り込み、算出した集計、`localStorage`
  への永続化も管理します。
- [`src/main.tsx`](./src/main.tsx) は ViewModel を `KnockoutScope` に渡し、コンポーネント
  ツリーへの提供とバインディングの適用を行います。
- [`src/App.tsx`](./src/App.tsx) はマークアップを所有します。`useKoViewModel` で
  ViewModel を取得し、`data-bind` でコントロールをバインドし、キー付きの本の行を
  `KoForeach` で描画するため、コンポーネントツリーの管理は React が担当します。

フォームはフィールドを React state に複製せず、双方向の `value` バインディングを
利用します。本を追加または編集すると、Knockout の算出集計と絞り込み済みの
`KoForeach` がすぐ更新されます。永続化用の computed も各本の observable を読むため、
変更内容は再読み込み後も残ります。

```tsx
const vm = useKoViewModel<AppViewModel>()

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
