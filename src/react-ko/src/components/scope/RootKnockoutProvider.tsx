import * as React from 'react'
import { useCallback, useContext, useState } from 'react'
import { AppViewModelContext } from '@/index'
import { ScopeViewModelContext } from '@/context/ScopeViewModelContext'
import { ScopeBindGenerationContext } from '@/context/ScopeBindGenerationContext'
import { ScopeBindingRootContext } from '@/context/ScopeBindingRootContext'
import { DESCENDANT_BINDING_BOUNDARY } from './descendantBindingBoundary'
import { useBindingRoot } from './useBindingRoot'
import { semanticHostComponent, type SemanticHostProps } from './semanticHost'

type Props<T> = SemanticHostProps & {
  viewModel: T
  children: React.ReactNode
}

/**
 * Applies Knockout bindings to the root, reapplies them when the ViewModel
 * changes, and provides the ViewModel via context.
 */
export const RootKnockoutProvider = React.memo(function RootKnockoutProvider<T>({
  viewModel,
  children,
  boundaryAs = 'div',
  as = 'div',
}: Props<T>) {
  const BoundaryHost = semanticHostComponent(boundaryAs)
  const BindingHost = semanticHostComponent(as)
  const parentGeneration = useContext(ScopeBindGenerationContext)
  const getParentBindingRoot = useContext(ScopeBindingRootContext)
  const deferChildrenUntilBound = React.useRef<boolean | null>(null)
  if (deferChildrenUntilBound.current === null) {
    deferChildrenUntilBound.current = getParentBindingRoot() !== null
  }
  const [bindingFailure, setBindingFailure] = useState<{ error: unknown } | null>(null)
  const handleBindingError = useCallback((error: unknown) => {
    setBindingFailure({ error })
  }, [])
  const {
    container: koContainer,
    generation,
    bindingEstablished,
    getBindingRoot,
  } = useBindingRoot(
    viewModel,
    parentGeneration,
    handleBindingError,
    deferChildrenUntilBound.current
  )

  if (bindingFailure !== null) {
    throw bindingFailure.error
  }

  return (
    <AppViewModelContext.Provider value={viewModel}>
      <ScopeViewModelContext.Provider value={viewModel}>
        <ScopeBindingRootContext.Provider value={getBindingRoot}>
          <ScopeBindGenerationContext.Provider value={generation}>
            <BoundaryHost data-bind={`${DESCENDANT_BINDING_BOUNDARY}: true`} style={{ display: 'contents' }}>
              <BindingHost ref={koContainer} style={{ display: 'contents' }}>
                {deferChildrenUntilBound.current && !bindingEstablished ? null : children}
              </BindingHost>
            </BoundaryHost>
          </ScopeBindGenerationContext.Provider>
        </ScopeBindingRootContext.Provider>
      </ScopeViewModelContext.Provider>
    </AppViewModelContext.Provider>
  )
})
