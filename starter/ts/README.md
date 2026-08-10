# react-ko starter (TypeScript)

en English | [ja 日本語](./README.ja.md)

The official TypeScript starter template for
[react-ko](https://github.com/menimani/react-ko), a minimal bridge between
React and Knockout.js. It lives inside the react-ko repository, so it is
always updated together with the library.

## Quick Start

```bash
npx degit menimani/react-ko/starter/ts my-app-ts
cd my-app-ts
npm install
npm run dev
```

Then open [`src/App.tsx`](./src/App.tsx) and edit freely.

For the JavaScript version, use `starter/js` instead:

```bash
npx degit menimani/react-ko/starter/js my-app-js
```

## What's included

- React + TypeScript + Vite (official template)
- Knockout.js and react-ko installed
- A working sample: a counter bound with `data-bind`, and a todo list built
  with `KoIf`, `KoIfNot`, and the `KoForeach` render prop
- No extra setup — `npm install` and go

## Sample code

```tsx
<KoForeach items={vm.list}>
  {(item) => <li>{item}</li>}
</KoForeach>
```

See [`src/components/TodoForm.tsx`](./src/components/TodoForm.tsx) for the
full example, and the [react-ko README](../../README.md) for the API.

## License

MIT
