import * as React from 'react'
import { useCallback, useContext, useState } from 'react'
import { useAppViewModel } from '@/index'
import { ScopeViewModelContext } from '@/context/ScopeViewModelContext'
import { ScopeBindGenerationContext } from '@/context/ScopeBindGenerationContext'
import { DESCENDANT_BINDING_BOUNDARY } from './descendantBindingBoundary'
import { useBindingRoot } from './useBindingRoot'

type Props<T> = {
  viewModel: T
  children: React.ReactNode
}

/**
 * Binds its children to the given view model with its own
 * `ko.applyBindings` call, so scopes mounted after the initial render
 * (rows of a KoForeach, children of a KoIf) are still bound, and unbinds
 * them with `ko.cleanNode` on unmount so subscriptions do not leak.
 */
export const KnockoutScope = React.memo(function KnockoutScope<T>({ viewModel, children }: Props<T>) {
  useAppViewModel()

  const parentGeneration = useContext(ScopeBindGenerationContext)
  const [bindingFailure, setBindingFailure] = useState<{ error: unknown } | null>(null)
  const handleBindingError = useCallback((error: unknown) => {
    setBindingFailure({ error })
  }, [])
  const { container, generation } = useBindingRoot(
    viewModel,
    parentGeneration,
    handleBindingError
  )

  if (bindingFailure !== null) {
    throw bindingFailure.error
  }

  return (
    <ScopeViewModelContext.Provider value={viewModel}>
      <ScopeBindGenerationContext.Provider value={generation}>
        <div data-bind={`${DESCENDANT_BINDING_BOUNDARY}: true`} style={{ display: 'contents' }}>
          <div ref={container} style={{ display: 'contents' }}>
            {children}
          </div>
        </div>
      </ScopeBindGenerationContext.Provider>
    </ScopeViewModelContext.Provider>
  )
})
