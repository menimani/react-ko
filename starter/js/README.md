# react-ko starter (JavaScript)

en English | [ja Japanese](./README.ja.md)

The official JavaScript starter template for
[react-ko](https://github.com/menimani/react-ko), a minimal bridge between
React and Knockout.js. It lives inside the react-ko repository, so it is
always updated together with the library.

## Quick Start

```bash
npx degit menimani/react-ko/starter/js my-app-js
cd my-app-js
npm install
npm run dev
```

Then open [`src/App.jsx`](./src/App.jsx) and edit freely.

For the TypeScript version, use `starter/ts` instead:

```bash
npx degit menimani/react-ko/starter/ts my-app-ts
```

## What's included

- React + Vite (official template)
- Knockout.js and react-ko installed
- An app-level ViewModel bound and provided by `KnockoutScope`
- `useKoViewModel` for reaching that ViewModel from anywhere in the scope
- Nested binding roots with two-way `data-bind` bindings
- A working todo list with keyed `KoForeach` rows, plain-JSX conditionals, and a
  detail view bound to the selected item
- `useKoValue` bridging an in-place `observableArray` update into React output
- No extra setup — `npm install` and go

## Sample code

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

Each row receives its own binding root as the third argument and spreads it onto
its own element, so the row is the semantic `li` directly under the `ul` and
nothing is added to the DOM. A row that binds nothing can ignore the argument.

See [`src/components/TodoForm.jsx`](./src/components/TodoForm.jsx) for the
full example, and the [react-ko README](https://github.com/menimani/react-ko/blob/main/README.md) for the API.

## License

MIT
