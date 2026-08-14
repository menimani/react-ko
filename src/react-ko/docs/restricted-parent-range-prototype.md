# Restricted-parent React range prototype

## Decision

Stage one did not find a React 18/19-compatible technique that satisfies all of
these requirements at the same time:

- React renders the children directly under a restricted parent such as
  `select`, without a wrapper element.
- react-ko delimits the children as a range, including while that range is
  empty.
- React's DOM renderer retains truthful ownership of every rendered node.
- Client updates and server hydration use the same ownership model.

At the end of stage one, the structural components were therefore not changed.
Its range approaches remain rejected.

## Prototype: `Option` under `select`

These cases were originally explored as standalone React experiments.

### Raw Fragment

Returning options in a Fragment works when no library range is involved:

```tsx
function Options({ values }: { values: string[] }) {
  return <>{values.map((value) => <option key={value}>{value}</option>)}</>
}
```

The server markup contains only `option` elements, hydration reuses the server
option, and React can add another option. The cost is that a Fragment exposes
no parent or start/end boundary in the React 18 API. A component that renders
an empty Fragment has no DOM position from which react-ko could establish a
range.

### DOM comments around normally rendered children

Adding comments around an already-mounted option does not make them part of
React's placement model. After the option is removed and returned, React places
it according to the next React-owned host sibling (or appends it), not according
to the comments:

```html
<!--range-start--><!--range-end--><option>prototype</option>
```

Moving the option back between the comments would make react-ko, rather than
React, move a React-owned node. It also cannot solve the initially empty case.

### Detached `DocumentFragment` container

React accepts a `DocumentFragment` as a root or portal container. Moving its
rendered option into the `select` makes the real parent differ from the
container recorded by React. A later unmount asks the fragment to remove a
child it no longer contains and fails with `NotFoundError`.

Overriding the fragment's mutation methods can route inserts and removals into
a comment range, but it only hides the mismatch: `option.parentNode` is the
`select`, while React's container is the fragment. Event delegation is attached
to the fragment, and server rendering cannot emit a portal for hydration. This
is not a supported DOM container and does not meet the ownership constraint.

### Other rejected routes

- A portal to the `select` itself needs the parent element before rendering and
  treats the whole `select`, not a delimited range, as its container.
- A child ref can discover the parent only after a non-empty child commits. It
  cannot represent an initially empty range and does not affect later React
  placement.
- Suspense hydration comments and React fiber fields are implementation details,
  not a public range API. React 19-only Fragment ref capabilities also cannot be
  used while React 18 remains supported.
- A placeholder element would provide a ref but violates the required markup
  and was explicitly outside the prototype scope.

## Knockout impact

The existing `KnockoutScope` hosts are also the descendant-binding boundary and
the per-scope binding root. Removing those hosts without an equivalent range
would let the enclosing Knockout root bind rows with the wrong view model, or
would require react-ko to clean and rebind React-owned nodes. The raw Fragment
success therefore is not enough to preserve the current `KoForeach` behavior.
