import * as React from 'react'
import type * as ko from 'knockout'
import { KnockoutScope, useKoValue } from '@/index'
import { useScopeViewModel } from '@/context/ScopeViewModelContext'

type Props = {
  condition: ko.Observable<boolean> | ko.Computed<boolean> | boolean
  children: React.ReactNode
}

/**
 * Renders children only while the condition is false. The children are
 * wrapped in a scope bound to the enclosing view model on every mount,
 * so `data-bind` attributes inside keep working across toggles.
 */
export const KoIfNot = React.memo(function KoIfNot({ condition, children }: Props) {
  const visible = useKoValue(condition)
  const viewModel = useScopeViewModel()

  if (visible) {
    return null
  }

  return <KnockoutScope viewModel={viewModel}>{children}</KnockoutScope>
})
