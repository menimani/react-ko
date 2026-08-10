import { useCallback, useRef, useSyncExternalStore } from 'react'
import knockout from 'knockout'
import type * as ko from 'knockout'

/**
 * Returns the current value of a Knockout observable or computed and
 * re-renders the component whenever it notifies. Plain values pass through
 * unchanged, so a prop typed `ko.Observable<T> | T` can be read either way.
 *
 * The store snapshot is a notification counter rather than the value itself:
 * an observableArray mutates its underlying array in place, so the reference
 * never changes and a value comparison would miss every update.
 */
export function useKoValue<T>(source: ko.Observable<T> | ko.Computed<T> | T): T {
  const version = useRef(0)
  const rendered = useRef<unknown>(undefined)

  const subscribe = useCallback((onStoreChange: () => void) => {
    if (!knockout.isSubscribable(source)) {
      return () => {}
    }
    const subscription = source.subscribe(() => {
      version.current += 1
      onStoreChange()
    })
    // A notification fired between render and this point (a sibling's layout
    // effect, a binding's init) left no trace in the counter; reconcile
    // against what the last render actually saw.
    if (!sameAsRendered(knockout.unwrap(source), rendered.current)) {
      version.current += 1
      onStoreChange()
    }
    return () => subscription.dispose()
  }, [source])

  const getSnapshot = useCallback(() => version.current, [])

  useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const value = knockout.unwrap(source)
  // Arrays are kept as a shallow copy because the source mutates in place:
  // comparing the live array against itself would hide every change.
  rendered.current = Array.isArray(value) ? value.slice() : value
  return value
}

function sameAsRendered(current: unknown, rendered: unknown): boolean {
  if (Array.isArray(current) && Array.isArray(rendered)) {
    return current.length === rendered.length
      && current.every((item, index) => Object.is(item, rendered[index]))
  }
  return Object.is(current, rendered)
}
