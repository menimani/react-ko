import React, { useMemo, useLayoutEffect } from 'react'
import { useAppViewModel } from './context/AppViewModelContext'

type Props<T> = {
  viewModel: T
  children: React.ReactNode
}

/**
 * Knockoutの `with:` バインディングを使って、
 * サブViewModelにスコープを絞るためのラッパー
 */
export const KnockoutScope = React.memo(function KnockoutScope<T>({ viewModel, children }: Props<T>) {
  const appViewModel = useAppViewModel()

  const uniqueKey = useMemo(() => crypto.randomUUID(), [])

  useLayoutEffect(() => {
    ;(appViewModel as any)[uniqueKey] = viewModel

    return () => {
      delete (appViewModel as any)[uniqueKey]
    }
  }, [appViewModel, viewModel, uniqueKey])

  return (
    <div data-bind={`with: $root['${uniqueKey}']`} style={{ display: 'contents' }}>
      {children}
    </div>
  )
})