import { useCallback, useMemo, useSyncExternalStore } from 'react'
import knockout from 'knockout'
import type * as ko from 'knockout'

/**
 * Returns the current value of a Knockout observable or computed and
 * re-renders the component whenever it notifies. Plain values pass through
 * unchanged, so a prop typed `ko.Observable<T> | T` can be read either way,
 * and an optional prop keeps its own `T | undefined` shape instead of forcing
 * `T` to absorb the `undefined`.
 *
 * The store snapshot is a notification counter rather than the value itself:
 * an observableArray mutates its underlying array in place, so the reference
 * never changes and a value comparison would miss every update.
 */
export function useKoValue<T>(
  source: ko.ObservableArray<T>
): T[]
export function useKoValue<T>(source: ko.Observable<T> | ko.Computed<T> | T): T
export function useKoValue<T>(
  source: ko.Observable<T> | ko.Computed<T> | T | undefined
): T | undefined
export function useKoValue<T>(
  source: ko.Observable<T> | ko.Computed<T> | T | undefined
): T | undefined {
  const notificationVersion = useMemo(() => {
    if (!knockout.isSubscribable(source)) {
      return null
    }

    let version = 0
    return knockout.pureComputed(() => {
      knockout.unwrap(source)
      version += 1
      return version
    })
  }, [source])

  const subscribe = useCallback((onStoreChange: () => void) => {
    if (notificationVersion === null) {
      return () => {}
    }
    const subscription = notificationVersion.subscribe(onStoreChange)
    return () => subscription.dispose()
  }, [notificationVersion])

  const getSnapshot = useCallback(
    () => notificationVersion?.() ?? 0,
    [notificationVersion]
  )

  useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  return source === undefined ? undefined : knockout.unwrap(source)
}
