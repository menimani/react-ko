import React, { useMemo, useLayoutEffect } from 'react'
import { useAppViewModel } from './context/AppViewModelContext'

type Props<T> = {
  vm: T
  children: React.ReactNode
}

/**
 * Knockoutの `with:` バインディングを使って、
 * サブViewModelにスコープを絞るためのラッパー
 */
export const KnockoutScope = React.memo(function KnockoutScope<T>({ vm, children }: Props<T>) {
  const appViewModel = useAppViewModel()

  const uniqueKey = useMemo(() => crypto.randomUUID(), [])

  useLayoutEffect(() => {
    ;(appViewModel as any)[uniqueKey] = vm

    return () => {
      delete (appViewModel as any)[uniqueKey]
    }
  }, [appViewModel, vm, uniqueKey])

  return (
    <div data-bind={`with: $root['${uniqueKey}']`} style={{ display: 'contents' }}>
      {children}
    </div>
  )
})