import * as React from 'react'
import type * as ko from 'knockout'
import { KnockoutScope, useKoValue } from '@/index'

type Props<T> = {
  value: ko.Observable<T> | ko.Computed<T> | T
  children: (value: NonNullable<T>) => React.ReactNode
}

/**
 * Renders the render prop for a non-nullish value and binds the returned JSX
 * to that value. React owns mounting and unmounting the children; Knockout is
 * only responsible for bindings inside the resulting scope.
 */
export function KoWith<T>({ value, children }: Props<T>) {
  const current = useKoValue<T>(value)

  if (current === null || current === undefined) {
    return null
  }

  return <KnockoutScope viewModel={current}>{children(current)}</KnockoutScope>
}
