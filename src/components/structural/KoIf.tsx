import React from 'react'
import { KnockoutScope } from '@/index'

type Props = {
  condition: KnockoutObservable<boolean> | boolean
  children: React.ReactNode
}

/**
 * Wraps children with a Knockout `if:` binding using a `div` container.
 * Safer and more efficient than comment-based bindings in React.
 * Recommended for standard usage when template compatibility is not required.
 */
export const KoIf = React.memo(function KoIf({ condition, children }: Props) {
  const vm = { condition }

  return (
    <KnockoutScope viewModel={vm}>
      <div data-bind="if: condition"  style={{ display: 'contents' }}>
        {children}
      </div>
    </KnockoutScope>
  )
})
