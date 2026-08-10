import { useCallback, useRef, useSyncExternalStore } from 'react'
import * as ko from 'knockout'

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

  const subscribe = useCallback((onStoreChange: () => void) => {
    if (!ko.isSubscribable(source)) {
      return () => {}
    }
    const subscription = source.subscribe(() => {
      version.current += 1
      onStoreChange()
    })
    return () => subscription.dispose()
  }, [source])

  const getSnapshot = useCallback(() => version.current, [])

  useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  return ko.unwrap(source)
}
