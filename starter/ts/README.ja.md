# react-ko starter (TypeScript)

[en English](./README.md) | ja 日本語

[react-ko](https://github.com/menimani/react-ko)（React と Knockout.js の
最小限のブリッジライブラリ）の公式 TypeScript スターターテンプレートです。
react-ko リポジトリ内にあるため、ライブラリ本体と常に一緒に更新されます。

## クイックスタート

```bash
npx degit menimani/react-ko/starter/ts my-app-ts
cd my-app-ts
npm install
npm run dev
```

[`src/App.tsx`](./src/App.tsx) を開いて自由に編集してください。

JavaScript 版は `starter/js` を使ってください：

```bash
npx degit menimani/react-ko/starter/js my-app-js
```

## 含まれているもの

- React + TypeScript + Vite（公式テンプレート）
- Knockout.js と react-ko インストール済み
- 動作するサンプル：`data-bind` によるカウンター、`KoIf` / `KoIfNot` と
  `KoForeach` の render prop で作った todo リスト
- 余計な構成なし — `npm install` してすぐ開発可能

## サンプルコード

```tsx
<KoForeach items={vm.list}>
  {(item) => <li>{item}</li>}
</KoForeach>
```

完全な例は [`src/components/TodoForm.tsx`](./src/components/TodoForm.tsx)、
API は [react-ko の README](https://github.com/menimani/react-ko/blob/main/README.ja.md) を参照してください。

## ライセンス

MIT
