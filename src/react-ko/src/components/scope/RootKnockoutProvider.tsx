import * as React from 'react'
import { useCallback, useContext, useRef, useLayoutEffect, useState } from 'react'
import ko from 'knockout'
import { AppViewModelContext } from '@/index'
import { ScopeViewModelContext } from '@/context/ScopeViewModelContext'
import { ScopeBindGenerationContext } from '@/context/ScopeBindGenerationContext'
import { applyBindingsSafely } from './applyBindingsSafely'
import { DESCENDANT_BINDING_BOUNDARY } from './descendantBindingBoundary'
import { observeBindingDescendants } from './observeBindingDescendants'

type Props<T> = {
  viewModel: T
  children: React.ReactNode
}

/**
 * Applies Knockout bindings to the root, reapplies them when the ViewModel
 * changes, and provides the ViewModel via context.
 */
export const RootKnockoutProvider = React.memo(function RootKnockoutProvider<T>({ viewModel, children }: Props<T>) {
  const koContainer = useRef<HTMLDivElement | null>(null)
  const parentGeneration = useContext(ScopeBindGenerationContext)
  const [generation, setGeneration] = useState(0)
  const [bindingFailure, setBindingFailure] = useState<{ error: unknown } | null>(null)
  const isFirstBind = useRef(true)
  const handleBindingError = useCallback((error: unknown) => {
    setBindingFailure({ error })
  }, [])

  useLayoutEffect(() => {
    const node = koContainer.current
    if (node === null) {
      return
    }
    applyBindingsSafely(viewModel, node)
    const stopObserving = observeBindingDescendants(viewModel, node, handleBindingError)

    // Cleaning the root also disposes bindings owned by nested binding roots.
    // Let the nearest descendants know that they must bind themselves again.
    if (isFirstBind.current) {
      isFirstBind.current = false
    } else {
      setGeneration((current) => current + 1)
    }

    return () => {
      stopObserving()
      ko.cleanNode(node)
    }
  }, [viewModel, parentGeneration, handleBindingError])

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
