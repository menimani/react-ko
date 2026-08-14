import * as React from 'react'
import type * as ko from 'knockout'
import { useKoValue, type KoBindProps } from '@/index'
import { useKoBindAlways } from '@/hooks/useKoBind'

type NullableItems<T> =
  | ko.Observable<T[] | null | undefined>
  | ko.Observable<readonly T[] | null | undefined>
  | ko.Computed<T[] | null | undefined>
  | ko.Computed<readonly T[] | null | undefined>
  | readonly T[]
  | null
  | undefined

type CommonProps<T> = {
  items:
    | ko.ObservableArray<T>
    | ko.Observable<T[]>
    | ko.Observable<readonly T[]>
    | ko.Computed<T[]>
    | ko.Computed<readonly T[]>
    | NullableItems<T>
  itemKey?: (item: T, index: number) => React.Key
}

type Props<T> = CommonProps<T> & {
  /**
   * Rendered once per item. The third argument is the row's binding root: spread it
   * onto the element that holds the row's `data-bind` attributes, or ignore it when
   * the row binds nothing.
   */
  children: (item: T, index: number, bind: KoBindProps) => React.ReactNode
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
 * A row exists so that the binding hook can be called once per item: a hook cannot be
 * called from inside a loop, which is the whole reason this component is not a hook.
 */
function KoForeachRow<T>({
  item,
  index,
  render,
}: {
  item: T
  index: number
  render: (item: T, index: number, bind: KoBindProps) => React.ReactNode
}) {
  const bind = useKoBindAlways(item)
  return <>{render(item, index, bind)}</>
}

/**
 * Renders the render prop once per item and hands it a binding root for that item,
 * so `data-bind` inside the row's own element refers to the row item directly. A row
 * that binds nothing can ignore the third argument; nothing is added to the DOM
 * either way. Iteration is owned by React: `$data`, `$index`, and `$parent` are
 * replaced by the function arguments and closures.
 */
export function KoForeach<T>(props: Props<T>) {
  // Knockout subscribables are invariant, so normalize the mutable and
  // readonly source variants after Props has checked the public input.
  const array =
    useKoValue<readonly T[] | null | undefined>(
      props.items as unknown as
        | ko.Observable<readonly T[] | null | undefined>
        | ko.Computed<readonly T[] | null | undefined>
        | readonly T[]
        | null
        | undefined
    ) ?? []
  const occurrences = new WeakMap<object, number>()

  return (
    <>
      {array.map((item, index) => {
        const key = props.itemKey
          ? props.itemKey(item, index)
          : defaultItemKey(item, index, occurrences)

        return (
          <KoForeachRow key={key} item={item} index={index} render={props.children} />
        )
      })}
    </>
  )
}
