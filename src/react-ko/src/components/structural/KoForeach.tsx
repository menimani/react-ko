import * as React from 'react'
import type * as ko from 'knockout'
import { KnockoutScope, useKoValue } from '@/index'
import type { SemanticHostProps } from '@/components/scope/semanticHost'

type NullableItems<T> =
  | ko.Observable<T[] | null | undefined>
  | ko.Observable<readonly T[] | null | undefined>
  | ko.Computed<T[] | null | undefined>
  | ko.Computed<readonly T[] | null | undefined>
  | readonly T[]
  | null
  | undefined

type Props<T> = SemanticHostProps & {
  items:
    | ko.ObservableArray<T>
    | ko.Observable<readonly T[]>
    | ko.Computed<T[]>
    | ko.Computed<readonly T[]>
    | NullableItems<T>
  children: (item: T, index: number) => React.ReactNode
  itemKey?: (item: T, index: number) => React.Key
}

// Auto-assigned keys: object items get a stable identity-and-occurrence key
// so their rows survive reorders and repeated references remain distinct;
// primitives cannot be tracked by identity and fall back to the index. Pass
// `itemKey` when rows hold state and items are primitive.
let nextAutoKey = 1
const autoKeys = new WeakMap<object, number>()

function defaultItemKey(
  item: unknown,
  index: number,
  occurrences: WeakMap<object, number>
): React.Key {
  if ((typeof item === 'object' && item !== null) || typeof item === 'function') {
    let key = autoKeys.get(item)
    if (key === undefined) {
      key = nextAutoKey
      nextAutoKey += 1
      autoKeys.set(item, key)
    }

    const occurrence = occurrences.get(item) ?? 0
    occurrences.set(item, occurrence + 1)
    return `object:${key}:${occurrence}`
  }
  return `index:${index}`
}

/**
 * Renders the render prop once per item, each wrapped in a scope bound to
 * that item, so `data-bind` inside a row refers to the row item directly.
 * Iteration is owned by React: `$data`, `$index`, and `$parent` are
 * replaced by the function arguments and closures.
 */
export function KoForeach<T>({ items, children, itemKey, boundaryAs, as }: Props<T>) {
  // Knockout subscribables are invariant, so normalize the mutable and
  // readonly source variants after Props has checked the public input.
  const array =
    useKoValue<readonly T[] | null | undefined>(
      items as unknown as
        | ko.Observable<readonly T[] | null | undefined>
        | ko.Computed<readonly T[] | null | undefined>
        | readonly T[]
        | null
        | undefined
    ) ?? []
  const occurrences = new WeakMap<object, number>()

  return (
    <>
      {array.map((item, index) => (
        <KnockoutScope
          key={itemKey ? itemKey(item, index) : defaultItemKey(item, index, occurrences)}
          viewModel={item}
          boundaryAs={boundaryAs}
          as={as}
        >
          {children(item, index)}
        </KnockoutScope>
      ))}
    </>
  )
}
