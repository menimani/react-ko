# react-ko Bookshelf starter (TypeScript)

en English | [ja Japanese](./README.ja.md)

The official TypeScript starter for [react-ko](https://github.com/menimani/react-ko),
a minimal bridge between React and Knockout.js. The included Bookshelf app is a
small reading log with add, edit, remove, filter, live summary, and local storage.

## Quick start

```bash
npx degit menimani/react-ko/starter/ts my-bookshelf
cd my-bookshelf
npm install
npm run dev
```

For JavaScript, use `starter/js` instead.

## How the sample is structured

- [`src/appViewModel.ts`](./src/appViewModel.ts) owns the shelf as a Knockout
  `observableArray`, the two-way form fields, status filter, computed summary,
  and `localStorage` persistence.
- [`src/main.tsx`](./src/main.tsx) places the ViewModel in `KnockoutScope`, which
  provides it to the component tree and applies the bindings.
- [`src/App.tsx`](./src/App.tsx) owns the markup. It retrieves the ViewModel with
  `useKoViewModel`, binds controls through `data-bind`, and renders keyed book
  rows with `KoForeach` so React remains responsible for the component tree.

The form demonstrates two-way `value` bindings without mirroring fields into
React state. Adding or editing a book updates the Knockout computed summary and
the filtered `KoForeach` immediately. The persistence computed also reads each
book's observables, so changes survive a reload.

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

See the [react-ko README](https://github.com/menimani/react-ko/blob/main/README.md)
for the complete API.

## License

MIT
