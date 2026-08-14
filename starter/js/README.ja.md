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
- `KnockoutScope` がバインドして提供するアプリレベルの ViewModel
- スコープ内のどこからでもその ViewModel を取得する `useKoViewModel`
- ネストしたバインディングルートによる双方向の `data-bind`
- キー付き `KoForeach` 行、素の JSX による条件分岐、選択中アイテムにバインドした
  詳細表示で作った動作する todo リスト
- `observableArray` のインプレース更新を React の表示につなぐ `useKoValue`
- 余計な構成なし — `npm install` してすぐ開発可能

## サンプルコード

```jsx
const itemCount = (useKoValue(vm.list) ?? []).length

<ul>
  <KoForeach items={vm.list} itemKey={(todo) => todo.id}>
    {(_todo, index, bind) => (
      <li {...bind}>{index + 1}. <span data-bind="text: title" /></li>
    )}
  </KoForeach>
</ul>
```

各行は第 3 引数として自分のバインディングルートを受け取り、それを自分の要素に
展開します。行は `ul` 直下のセマンティックな `li` そのものになり、DOM には何も
追加されません。バインドしない行は第 3 引数を無視できます。

完全な例は [`src/components/TodoForm.jsx`](./src/components/TodoForm.jsx)、
API は [react-ko の README](https://github.com/menimani/react-ko/blob/main/README.ja.md) を参照してください。

## ライセンス

MIT
