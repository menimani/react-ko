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
- A working sample: a counter bound with `data-bind`, and a todo list built
  with `KoIf`, `KoIfNot`, and the `KoForeach` render prop
- No extra setup — `npm install` and go

## Sample code

```jsx
<KoForeach items={vm.list}>
  {(item) => <li>{item}</li>}
</KoForeach>
```

See [`src/components/TodoForm.jsx`](./src/components/TodoForm.jsx) for the
full example, and the [react-ko README](https://github.com/menimani/react-ko/blob/main/README.md) for the API.

## License

MIT
