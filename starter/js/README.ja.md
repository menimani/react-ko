# react-ko starter (JavaScript)

[en English](./README.md) | ja 日本語

[react-ko](https://github.com/menimani/react-ko)（React と Knockout.js の
最小限のブリッジライブラリ）の公式 JavaScript スターターテンプレートです。
react-ko リポジトリ内にあるため、ライブラリ本体と常に一緒に更新されます。

## クイックスタート

```bash
npx degit menimani/react-ko/starter/js my-app-js
cd my-app-js
npm install
npm run dev
```

[`src/App.jsx`](./src/App.jsx) を開いて自由に編集してください。

TypeScript 版は `starter/ts` を使ってください：

```bash
npx degit menimani/react-ko/starter/ts my-app-ts
```

## 含まれているもの

- React + Vite（公式テンプレート）
- Knockout.js と react-ko インストール済み
- `RootKnockoutProvider` でバインドするアプリレベルの ViewModel
- 対応関係が保証された `createAppViewModelContext` の Provider と `useAppViewModel` フック
- ネストしたスコープによる双方向の `data-bind`
- `KoIf` / `KoIfNot`、キー付き `KoForeach` 行、nullable な `KoWith` 詳細表示で
  作った動作する todo リスト
- `observableArray` のインプレース更新を React の表示につなぐ `useKoValue`
- 余計な構成なし — `npm install` してすぐ開発可能

## サンプルコード

```jsx
const itemCount = (useKoValue(vm.list) ?? []).length

<ul>
  <KoForeach items={vm.list} itemKey={(todo) => todo.id} boundaryAs="li" as="div">
    {(_todo, index) => <div>{index + 1}. <span data-bind="text: title" /></div>}
  </KoForeach>
</ul>
```

`boundaryAs` により各行が `ul` 直下のセマンティックな `li` になり、`as` で
内側のバインディングホストを選べます。`button` などフレージングコンテンツのみを
許す要素内のスコープでは `boundaryAs="span" as="span"` を使います。

完全な例は [`src/components/TodoForm.jsx`](./src/components/TodoForm.jsx)、
API は [react-ko の README](https://github.com/menimani/react-ko/blob/main/README.ja.md) を参照してください。

## ライセンス

MIT
