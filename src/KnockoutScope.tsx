import React, { useMemo, useLayoutEffect } from 'react'
import { useAppViewModel } from './context/AppViewModelContext'

type Props<T> = {
  viewModel: T
  children: React.ReactNode
}

/**
 * Wraps a child component with a Knockout `with:` binding scope
 * to isolate a sub-ViewModel within the global ViewModel.
 */
export const KnockoutScope = React.memo(function KnockoutScope<T>({ viewModel, children }: Props<T>) {
  const appViewModel = useAppViewModel<Record<string, unknown>>()

  const uniqueKey = useMemo(() => crypto.randomUUID(), [])

  useLayoutEffect(() => {
    appViewModel[uniqueKey] = viewModel

    return () => {
      delete appViewModel[uniqueKey]
    }
  }, [appViewModel, viewModel, uniqueKey])

  return (
    <div data-bind={`with: $root['${uniqueKey}']`} style={{ display: 'contents' }}>
      {children}
    </div>
  )
})