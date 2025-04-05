import React from 'react'
import ko from 'knockout'
import { KnockoutScope } from '@/index'

type Props = {
  items: ko.Observable<unknown[]> | ko.Computed<unknown[]> | unknown[]
  children: React.ReactNode
}

/**
 * Renders children for each item in the given array.
 * Uses Knockout's `foreach:` binding internally.
 */
export const KoForeach = React.memo(function KoForeach({ items, children }: Props) {
  const vm = { items }

  return (
    <KnockoutScope viewModel={vm}>
      <div data-bind="foreach: items" style={{ display: 'contents' }}>
        {children}
      </div>
    </KnockoutScope>
  )
})