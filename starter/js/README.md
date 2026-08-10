# react-ko starter (JavaScript)

en English | [ja 日本語](./README.ja.md)

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
- A root provider and nested scopes with two-way `data-bind` bindings
- A working todo list built with `KoIf`, `KoIfNot`, keyed `KoForeach` rows,
  and a nullable `KoWith` detail view
- `useKoValue` bridging an in-place `observableArray` update into React output
- No extra setup — `npm install` and go

## Sample code

```jsx
const itemCount = useKoValue(vm.list).length

<KoForeach items={vm.list} itemKey={(todo) => todo.id}>
  {(_todo, index) => <li>{index + 1}. <span data-bind="text: title" /></li>}
</KoForeach>
```

See [`src/components/TodoForm.jsx`](./src/components/TodoForm.jsx) for the
full example, and the [react-ko README](https://github.com/menimani/react-ko/blob/main/README.md) for the API.

## License

MIT
