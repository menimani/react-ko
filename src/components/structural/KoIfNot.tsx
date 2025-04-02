import React from 'react'
import { KnockoutScope } from '../../KnockoutScope'

type Props = {
  condition: KnockoutObservable<boolean> | boolean
  children: React.ReactNode
}

/**
 * Renders children only when the given condition is false.
 * Uses Knockout's `ifnot:` binding internally.
 */
export const KoIfNot = React.memo(function KoIfNot({ condition, children }: Props) {
  const vm = { condition }

  return (
    <KnockoutScope viewModel={vm}>
      <div data-bind="ifnot: condition" style={{ display: 'contents' }}>
        {children}
      </div>
    </KnockoutScope>
  )
})