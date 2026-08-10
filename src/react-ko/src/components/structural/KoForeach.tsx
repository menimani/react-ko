import * as React from 'react'
import type * as ko from 'knockout'
import { KnockoutScope, useKoValue } from '@/index'

type Props<T> = {
  items: ko.ObservableArray<T> | ko.Observable<T[]> | ko.Computed<T[]> | T[]
  children: (item: T, index: number) => React.ReactNode
  itemKey?: (item: T, index: number) => React.Key
}

// Auto-assigned keys: object items get a stable identity-based key so their
// rows survive reorders; primitives cannot be tracked by identity and fall
// back to the index. Pass `itemKey` when rows hold state and items are
// primitive.
let nextAutoKey = 1
const autoKeys = new WeakMap<object, number>()

function defaultItemKey(item: unknown, index: number): React.Key {
  if ((typeof item === 'object' && item !== null) || typeof item === 'function') {
    let key = autoKeys.get(item)
    if (key === undefined) {
      key = nextAutoKey
      nextAutoKey += 1
      autoKeys.set(item, key)
    }
    return key
  }
  return index
}

/**
 * Renders the render prop once per item, each wrapped in a scope bound to
 * that item, so `data-bind` inside a row refers to the row item directly.
 * Iteration is owned by React: `$data`, `$index`, and `$parent` are
 * replaced by the function arguments and closures.
 */
export function KoForeach<T>({ items, children, itemKey }: Props<T>) {
  const array = useKoValue<T[]>(items)

  return (
    <>
      {array.map((item, index) => (
        <KnockoutScope key={(itemKey ?? defaultItemKey)(item, index)} viewModel={item}>
          {children(item, index)}
        </KnockoutScope>
      ))}
    </>
  )
}
