# react-ko

[en English](./README.md) | ja 日本語

[![npm version](https://img.shields.io/npm/v/react-ko)](https://www.npmjs.com/package/react-ko)

> Knockout.js を React コンポーネント内で使うための最小限のブリッジライブラリ。Knockout のリアクティブ性と React のコンポーネント構造をクリーンに融合します

---

## 特長

- Knockout の observable による双方向データバインディング
- JSX / TSX 上でそのまま `data-bind="..."` を使用可能
- `<KnockoutScope>` によるスコープ付き ViewModel
- `<RootKnockoutProvider>` による1行ルートバインディング
- `<KoForeach>` の render prop による型安全なリスト描画
- observable を React の state として読める `useKoValue`
- `data-bind` で扱う DOM の振る舞いには、React のイベントハンドラやローカル state のボイラープレート不要
- TypeScript / JavaScript の両対応（設定不要）
- Knockout、React、React DOM 以外のランタイム依存なし

---

## インストール

```bash
npm install react-ko knockout
```

> このライブラリは `react` (`^18.0.0 || ^19.0.0`)、`react-dom` (`^18.0.0 || ^19.0.0`)、`knockout` (`^3.5.1`) をピア依存としています。

---

## クイックスタート（スターターテンプレート）

### TypeScript

```bash
npx degit menimani/react-ko/starter/ts my-app-ts
cd my-app-ts
npm install && npm run dev
```

テンプレート: [`starter/ts`](https://github.com/menimani/react-ko/tree/main/starter/ts)

---

### JavaScript

```bash
npx degit menimani/react-ko/starter/js my-app-js
cd my-app-js
npm install && npm run dev
```

テンプレート: [`starter/js`](https://github.com/menimani/react-ko/tree/main/starter/js)

---

## クイック使用例（JSX / TSX）

```tsx
import ko from 'knockout'
import { RootKnockoutProvider, KnockoutScope } from 'react-ko'

const viewModel = {
  name: ko.observable('Alice')
}

<RootKnockoutProvider viewModel={{}}>
  <KnockoutScope viewModel={viewModel}>
    <input data-bind="value: name" />
  </KnockoutScope>
</RootKnockoutProvider>
```

`KoScope` も `KnockoutScope` の短い別名としてエクスポートされています。
どちらも同じコンポーネントを参照します。

スコープは、外側のバインディング境界と内側のバインディングルートという2つの
非スタイルホスト要素をレンダーします。既定値はどちらも `div` です。`div` が有効でない
位置では `boundaryAs` と `as` でセマンティックな HTML を選択できます。同じ prop は
`RootKnockoutProvider`、`KoIf`、`KoIfNot`、`KoForeach`、`KoWith` でも使えます。

```tsx
<button>
  <KnockoutScope viewModel={viewModel} boundaryAs="span" as="span">
    <span data-bind="text: name" />
  </KnockoutScope>
</button>
```

ホスト要素は構造用のままで、バインディング境界またはルート用 ref と
`display: contents` 以外のスタイルや ARIA prop は受け取りません。どちらのホストも
常に子要素を持つため、`boundaryAs` と `as` に指定できるのは非 void HTML 要素だけです。
`HTMLElementTagNameMap` の宣言マージで追加した非 void HTML 名にも対応し、その名前に
ハイフンは不要です。型境界とランタイム境界の両方で利用できます。`input`、`img`、
`br` などの既知の void 要素と、`svg` などの外来コンテンツのルートはランタイムで
拒否されます。それ以外の `SemanticHost` 値は、v2 互換性のためランタイムでも引き続き
受け付けます。ホストに対する制限の強化は、将来のメジャーリリースまで延期されます。

`RootKnockoutProvider` または `KnockoutScope` の `viewModel` を置き換えると、
Knockout バインディングが再適用されます。どちらのコンポーネントも、置き換え時と
アンマウント時にバインディングを破棄します。バインディングツリーの適用中に例外が
発生した場合も、それより前に作成された購読を Error Boundary に例外が届く前に破棄します。
ルートプロバイダーとスコープは入れ子にできます。それぞれが子孫バインディングの境界に
なるため、子要素はその境界自身の `viewModel` だけを使用し、そのバインディングルートと
ともにクリーンアップされます。
内部 Knockout バインディング名 `reactKoScopeBoundary` と
`reactKoCaptureDescendantContext` は、ルートプロバイダーまたはスコープが初めて
バインディングを適用するときに遅延登録されます。`useKoValue` だけを使う場合を含め、
react-ko を読み込むだけでは、これらの名前で登録済みのハンドラーは変更されません。
別のハンドラーがいずれかの名前を登録済みの場合は、バインディングルートのマウント時に
例外が発生します。
最初のバインディング適用後に React がマウントした子孫要素も、最も近いルートまたは
スコープへ子孫のレイアウト効果が実行される前に自動的にバインドされます。既存の Knockout `using` または `let`
バインディングの配下にマウントされた場合は、そのバインディングの子孫コンテキストを
引き継ぎます。React が削除した子孫要素のバインディングも自動的に破棄されます。
後から適用されるこれらのバインディングで発生した例外も、最も近い React Error Boundary に
届きます。React が既存要素の `data-bind` 属性を変更した場合は、以前のバインディングを破棄し、
同じ子孫コンテキストで新しい式を適用します。`text`、`html`、`component`、`options`
バインディングを取り除く場合は、現在のバインディングまたは React が描画した children に
所有権を渡す前に、Knockout が作成した内容も削除します。その他のバインディングを置き換える
場合は、新しい式を適用する前に、以前の式が所有していた属性、クラス、スタイル、フォーム
プロパティを復元します。DOM 効果を安全に破棄できないカスタムバインディングは拒否されます。
tooltip バインディングのように子孫を制御しないカスタムバインディングは、React が描画した
children を持つ要素でも引き続き使用できます。その場合、カスタムバインディング側で children を
変更せずに維持する必要があります。カスタムバインディングを空の要素に指定できるのは、所有する
内容を初回バインディング時にすべて作成する場合に限ります。後続のカスタムバインディングの
update で挿入された内容は所有対象として追跡されず、後から追加された子孫として再バインドまたは
拒否される可能性があるため、この使い方はサポートされません。
React の props 更新と有効な Knockout バインディングは同じ要素を共有することもできます。
React 側の最新のクラス、インラインスタイル、属性、フォームプロパティの初期値を保持しつつ、
有効な Knockout バインディングが宣言した DOM 効果は引き続きそのバインディングが所有します。
React が後から `option` を挿入または削除したり、その `value` を変更したりした場合も、
`selectedOptions` と `valueAllowUnset` を伴う `value` を再適用するため、現在の option の集合は
observable の再通知なしで同期されます。
`attr` バインディングを取り除くと、React の属性 props は React DOM と同じ規則で復元されます。
これには `acceptCharset` / `httpEquiv` のような別名を持つ props、false の `inert` やメディア無効化
props の属性削除、boolean の `download` と `capture` の空文字の存在属性が含まれます。

---

## カスタムコンポーネント例

### JavaScript (JSX)

```jsx
import { KnockoutScope } from 'react-ko'

export function KoInput({ value }) {
  const vm = { value }

  return (
    <KnockoutScope viewModel={vm}>
      <input data-bind="value: value" />
    </KnockoutScope>
  )
}
```

### TypeScript (TSX)

```tsx
import ko from 'knockout'
import { KnockoutScope } from 'react-ko'

type Props = {
  value: ko.Observable<string>
}

export function KoInput({ value }: Props) {
  const vm = { value }

  return (
    <KnockoutScope viewModel={vm}>
      <input data-bind="value: value" />
    </KnockoutScope>
  )
}
```

### コンポーネント使用例

`KnockoutScope` は内部で `useAppViewModel` を呼び出すため、
`RootKnockoutProvider` または `AppViewModelContext.Provider` の配下でレンダーする
必要があります。ルートプロバイダーは、ネストしたスコープの外側にある
`data-bind` 属性にもバインディングを適用します。クライアントのみでマウントする場合、
どちらのコンポーネントも children をマウントする前にバインディングホストを確立するため、
子孫の layout effect はすでにバインドされた DOM を操作できます。サーバーレンダリングと
ハイドレーションでは、React がその場でハイドレートできるよう、サーバーでレンダーされた
子サブツリーを保持します。

```tsx
import ko from 'knockout'
import { RootKnockoutProvider } from 'react-ko'

const vm = {
  name: ko.observable('Alice')
}

<RootKnockoutProvider viewModel={vm}>
  <KoInput value={vm.name} />
</RootKnockoutProvider>
```

---

## 構造コンポーネント

React が描画した children を制御するために、Knockout の `if`、`ifnot`、
`foreach`、`template`、`with` の制御フローバインディングを使わないでください。
これらのバインディングは React が所有している子 DOM ノードを削除または複製します。
`RootKnockoutProvider` と `KnockoutScope` は、そのバインディングルート内のいずれの
バインディングも適用する前にこれらを拒否します。これには、初回レンダー時または
後続の置換時に `dangerouslySetInnerHTML` で挿入される、コンテナーレスの制御フローコメントも
含まれます。安全性チェックはカスタム `preprocess` フックの実行後のバインディングを検査するため、
カスタムエイリアスから React が描画した children に対してこれらのバインディングを追加することもできません。
代わりに `KoIf`、`KoIfNot`、
`KoForeach`、`KoWith` を使ってください。

`text`、`html`、`component`、`options` バインディングも要素の内容を置き換えます。
これらを使用できるのは、バインド対象の要素に React が描画した children がない場合
だけです。children がある場合は、その DOM が切り離される前にバインディングを拒否します。
React が直接描画するスカラーのテキストと `dangerouslySetInnerHTML` で挿入する内容も、React が描画した
children として扱います。React 19 は `bigint` children をスカラーのテキストとして描画するため同じ制約が適用されますが、
React 18 は何も描画しないため、`bigint` child だけならコンテンツバインディングと競合しません。
この制約はバインディングの適用後に React が条件付きで children を
追加した場合にも適用されます。React 要素の挿入はその子の layout effect が実行される前に
同期的に拒否され、直接のテキストまたは HTML の挿入は後続の再調整で拒否されます。Knockout が
内容を所有している間は、その要素を空にしてください。空文字列の children または空の
`dangerouslySetInnerHTML` ペイロードをバインディング後に明示的に追加または削除する更新も、
Knockout が所有する内容を消去するため拒否されます。一方、既存のテキストまたは HTML を
削除するのと同じレンダーで内容バインディングを追加すれば、その要素の所有権を React から Knockout へ引き渡せます。

### `KoForeach`

`KoForeach` は render prop を取ります。関数は各アイテムとそのインデックスを
受け取り、返した JSX はそのアイテムにバインドされます — 行内の `data-bind`
は行アイテムを直接参照できます。

```tsx
import ko from 'knockout'
import { KoForeach, RootKnockoutProvider } from 'react-ko'

type Todo = {
  title: ko.Observable<string>
  done: ko.Observable<boolean>
}

const vm = { todos: ko.observableArray<Todo>([]) }

<RootKnockoutProvider viewModel={vm}>
  <ul>
    <KoForeach items={vm.todos} boundaryAs="li" as="div">
      {(todo, index) => (
        <div>
          <span>{index + 1}.</span>
          <input type="checkbox" data-bind="checked: done" />
          <input data-bind="value: title" />
          <button onClick={() => vm.todos.remove(todo)}>削除</button>
        </div>
      )}
    </KoForeach>
  </ul>
</RootKnockoutProvider>
```

- `items` は可変・読み取り専用の配列を受け付け、observable や computed
  の配列も指定できます。素の値、observable、computed のいずれでも配列値に
  `null` または `undefined` を指定でき、どちらも空のリストとして描画されます。
- `$data` / `$index` / `$parent` の代わりに、関数引数とクロージャを
  使います — 外側の変数（上の例の `vm`）はそのまま見え、行の中に React
  コンポーネントを置けます。
- 行のキーは `itemKey` があればそれを使い、なければオブジェクトは同一性と
  出現順（同じ参照が複数あっても一意になります）を使い、プリミティブは
  index にフォールバックします。行が状態を持ちアイテムがプリミティブな
  場合は `itemKey` を渡してください。
- `boundaryAs` と `as` は各行の2つのホストを選択します。上の例では外側の
  `li` が `ul` の有効な直接の子になり、コールバックは別の `li` ではなくその内容を返します。

ネストは普通の JSX として書けます：

```tsx
<KoForeach items={vm.groups}>
  {(group) => (
    <section>
      <h2 data-bind="text: name" />
      <KoForeach items={group.items}>
        {(item) => <Row item={item} group={group} />}
      </KoForeach>
    </section>
  )}
</KoForeach>
```

### `KoIf` / `KoIfNot`

条件が true（`KoIf`）または false（`KoIfNot`）の間だけ children を描画
します。`condition` は Knockout observable、computed、または素の boolean を
受け付けます。children 内の `data-bind` は外側スコープの ViewModel を参照します。

```tsx
import ko from 'knockout'
import { KoIf, RootKnockoutProvider } from 'react-ko'

const vm = {
  isVisible: ko.observable(true),
  message: ko.observable('こんにちは')
}

<RootKnockoutProvider viewModel={vm}>
  <KoIf condition={vm.isVisible}>
    <p data-bind="text: message" />
  </KoIf>
</RootKnockoutProvider>
```

### `KoWith`

nullish でない値の children を描画し、返された JSX をその値にバインドします。
render prop が `$data` の代わりになり、外側スコープの値にはクロージャを使えます。
`value` は observable、computed、または nullable な素の値を受け付けます。
`false`、`0`、`''` などの falsy 値も、有効な値として扱います。

```tsx
import ko from 'knockout'
import { KoWith, RootKnockoutProvider } from 'react-ko'

type Todo = { title: ko.Observable<string> }

const vm = {
  selectedTodo: ko.observable<Todo | null>({
    title: ko.observable('ドキュメントを書く')
  })
}

<RootKnockoutProvider viewModel={vm}>
  <KoWith value={vm.selectedTodo}>
    {() => (
      <section>
        <input data-bind="value: title" />
        <button onClick={() => vm.selectedTodo(null)}>削除</button>
      </section>
    )}
  </KoWith>
</RootKnockoutProvider>
```

---

## useAppViewModel

Provider と型が結びついた安全な経路には、対応する Provider とフックを一度作成します。
ViewModel の型は作成時に固定されるため、フックの使用時に無関係な型へ置き換えられません。

```tsx
import { createAppViewModelContext, RootKnockoutProvider } from 'react-ko'

type AppViewModel = { title: string }
const TypedAppViewModelContext = createAppViewModelContext<AppViewModel>()
const vm: AppViewModel = { title: 'Hello' }

function Title() {
  const vm = TypedAppViewModelContext.useAppViewModel() // AppViewModel
  return <h1>{vm.title}</h1>
}

<TypedAppViewModelContext.Provider value={vm}>
  <RootKnockoutProvider viewModel={vm}>
    <Title />
  </RootKnockoutProvider>
</TypedAppViewModelContext.Provider>
```

対応する Provider がない場合、フックは例外をスローします。従来の
`useAppViewModel<T>()` と `AppViewModelContext.Provider` は v2 でも利用できますが、
フックのジェネリック型は未検査の型アサーションであり、非推奨です。指定した ViewModel は
そのまま返され、`T` に含めれば `null` と `undefined` も有効な値として扱われます。

---

## useKoValue

Knockout の observable / computed / 素の値を React の state として読み
ます。現在値を返し、変更されるとコンポーネントを再レンダーします。
Knockout の値を React の世界（JSX の補間、effect の依存配列、props への
受け渡し）へ持ち込む唯一の正規ルートです。

```tsx
import type * as ko from 'knockout'
import { useKoValue } from 'react-ko'

function Greeting({ name }: { name: ko.Observable<string> }) {
  const value = useKoValue(name) // string 型、変更で再レンダー
  return <p>Hello, {value}!</p>
}
```

optional なソースは形を保ちます: `ko.Observable<string> | undefined` 型の
プロパティに `useKoValue` を使うと `string | undefined` が返ります。
Knockout の遅延更新モード（`ko.options.deferUpdates = true`）はライブラリ
全体でサポートされており、値は遅延通知の実行時に反映されます。

---

## v1 からの移行

v2 には破壊的変更が含まれます：

- **`KoForeach` の children が関数になりました** `(item, index) => ReactNode`。
  v1 の形式（素の JSX を Knockout の `foreach:` に委譲）は廃止です —
  React が所有する DOM を Knockout が複製する構造だったためです。
- **`KoIfComment` / `KoIfNotComment` / `KoForeachComment` は予告どおり
  削除されました。** `KoIf` / `KoIfNot` / `KoForeach` を使ってください。
- **各 `KnockoutScope` が独立したバインディングルートになりました。**
  スコープ内の `$root` はそのスコープ自身の ViewModel を指し、`$parent`
  はスコープ境界を越えません。props とクロージャを使ってください。
- **`KoIf` / `KoIfNot` の children 内の `data-bind`** は外側スコープの
  ViewModel に対して解決されるようになりました（以前は condition を
  保持する内部ラッパーオブジェクトを参照していました）。

---

## なぜ react-ko？

従来の React：

```tsx
<input
  value={value}
  onChange={(e) => setValue(e.target.value)}
  style={{ color }}
/>
```

react-ko を使うと：

```tsx
<input data-bind="value: value, style: { color: color }" />
```

`data-bind` で扱う DOM の振る舞いには、React のイベントやローカル state の記述は不要。
Knockout の observable に任せるだけで、UI がリアクティブに更新されます。

---

## 開発

```bash
npm install
npm run build
```

リポジトリのフックはクローンごとに一度有効化してください：

```bash
git config core.hooksPath .githooks
```

スターターは npm workspaces なので、ルートで install すれば公開前でも
ローカルのライブラリを参照してそのまま動かせます：

```bash
npm run dev --workspace=starter/ts
```

このリポジトリを保守する自律改善ループは `orchestration/` にあります。
起動と再開の方法は `orchestration/CLAUDE.md` を参照してください。

---

## ライセンス

MIT
