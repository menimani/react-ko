import * as React from 'react'
import { useCallback, useContext, useLayoutEffect, useRef, useState } from 'react'
import ko from 'knockout'
import { useAppViewModel } from '@/index'
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
 * Binds its children to the given view model with its own
 * `ko.applyBindings` call, so scopes mounted after the initial render
 * (rows of a KoForeach, children of a KoIf) are still bound, and unbinds
 * them with `ko.cleanNode` on unmount so subscriptions do not leak.
 */
export const KnockoutScope = React.memo(function KnockoutScope<T>({ viewModel, children }: Props<T>) {
  useAppViewModel()

  const container = useRef<HTMLDivElement | null>(null)
  const parentGeneration = useContext(ScopeBindGenerationContext)
  const [generation, setGeneration] = useState(0)
  const [bindingFailure, setBindingFailure] = useState<{ error: unknown } | null>(null)
  const isFirstBind = useRef(true)
  const handleBindingError = useCallback((error: unknown) => {
    setBindingFailure({ error })
  }, [])

  useLayoutEffect(() => {
    const node = container.current
    if (node === null) {
      return
    }
    applyBindingsSafely(viewModel, node)
    const stopObserving = observeBindingDescendants(viewModel, node, handleBindingError)

    // Rebinding means the cleanup's ko.cleanNode just disposed every nested
    // binding, and the fresh pass stopped at descendant boundaries. Announce
    // a new generation so descendant binding roots rebind themselves.
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
