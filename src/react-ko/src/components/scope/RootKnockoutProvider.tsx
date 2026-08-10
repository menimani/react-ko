import * as React from 'react'
import { useCallback, useContext, useState } from 'react'
import { AppViewModelContext } from '@/index'
import { ScopeViewModelContext } from '@/context/ScopeViewModelContext'
import { ScopeBindGenerationContext } from '@/context/ScopeBindGenerationContext'
import { DESCENDANT_BINDING_BOUNDARY } from './descendantBindingBoundary'
import { useBindingRoot } from './useBindingRoot'

type Props<T> = {
  viewModel: T
  children: React.ReactNode
}

/**
 * Applies Knockout bindings to the root, reapplies them when the ViewModel
 * changes, and provides the ViewModel via context.
 */
export const RootKnockoutProvider = React.memo(function RootKnockoutProvider<T>({ viewModel, children }: Props<T>) {
  const parentGeneration = useContext(ScopeBindGenerationContext)
  const [bindingFailure, setBindingFailure] = useState<{ error: unknown } | null>(null)
  const handleBindingError = useCallback((error: unknown) => {
    setBindingFailure({ error })
  }, [])
  const { container: koContainer, generation } = useBindingRoot(
    viewModel,
    parentGeneration,
    handleBindingError
  )

  if (bindingFailure !== null) {
    throw bindingFailure.error
  }

  return (
    <AppViewModelContext.Provider value={viewModel}>
      <ScopeViewModelContext.Provider value={viewModel}>
        <ScopeBindGenerationContext.Provider value={generation}>
          <div data-bind={`${DESCENDANT_BINDING_BOUNDARY}: true`} style={{ display: 'contents' }}>
            <div ref={koContainer} style={{ display: 'contents' }}>
              {children}
            </div>
          </div>
        </ScopeBindGenerationContext.Provider>
      </ScopeViewModelContext.Provider>
    </AppViewModelContext.Provider>
  )
})
