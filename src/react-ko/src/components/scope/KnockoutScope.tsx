import * as React from 'react'
import { useCallback, useContext, useState } from 'react'
import { useAppViewModel } from '@/index'
import { ScopeViewModelContext } from '@/context/ScopeViewModelContext'
import { ScopeBindGenerationContext } from '@/context/ScopeBindGenerationContext'
import { DESCENDANT_BINDING_BOUNDARY } from './descendantBindingBoundary'
import { useBindingRoot } from './useBindingRoot'
import { semanticHostComponent, type SemanticHostProps } from './semanticHost'

type Props<T> = SemanticHostProps & {
  viewModel: T
  children: React.ReactNode
}

/**
 * Binds its children to the given view model with its own
 * `ko.applyBindings` call, so scopes mounted after the initial render
 * (rows of a KoForeach, children of a KoIf) are still bound, and unbinds
 * them with `ko.cleanNode` on unmount so subscriptions do not leak.
 */
export const KnockoutScope = React.memo(function KnockoutScope<T>({
  viewModel,
  children,
  boundaryAs = 'div',
  as = 'div',
}: Props<T>) {
  const BoundaryHost = semanticHostComponent(boundaryAs)
  const BindingHost = semanticHostComponent(as)
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
        <BoundaryHost data-bind={`${DESCENDANT_BINDING_BOUNDARY}: true`} style={{ display: 'contents' }}>
          <BindingHost ref={container} style={{ display: 'contents' }}>
            {children}
          </BindingHost>
        </BoundaryHost>
      </ScopeBindGenerationContext.Provider>
    </ScopeViewModelContext.Provider>
  )
})
