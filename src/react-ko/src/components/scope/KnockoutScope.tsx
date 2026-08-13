import * as React from 'react'
import { useCallback, useContext, useState } from 'react'
import { ScopeBindGenerationContext } from '@/context/ScopeBindGenerationContext'
import { DESCENDANT_BINDING_BOUNDARY } from './descendantBindingBoundary'
import { useBindingRoot } from './useBindingRoot'

type Props<T> = {
  viewModel: T
  children: React.ReactNode
}

/**
 * Binds its children to the given view model, in the cases `useKoBind` cannot serve.
 *
 * The hook is the ordinary way to bind, and it adds nothing to the DOM. What it cannot
 * do is render: React attaches refs from the bottom up and runs a component's own
 * effects after its subtree's mutations, so a root taken from the caller's ref learns
 * about its subtree last. This component renders an inert marker before its host, and a
 * first child's ref and effects run before its siblings' -- which is what lets it bind an
 * element that arrives after it, and apply a replacement view model before the observer
 * reaches a child the same commit changed.
 *
 * Reach for it when children arrive later or the view model is replaced alongside them,
 * and for anything else prefer the hook. The hosts are plain divs with
 * `display: contents`: an element that has to be something else -- a row of a table, an
 * option of a select -- is the caller's own, through `useKoBind`.
 */
export const KnockoutScope = React.memo(function KnockoutScope<T>({
  viewModel,
  children,
}: Props<T>) {
  const parentGeneration = useContext(ScopeBindGenerationContext)
  const [bindingFailure, setBindingFailure] = useState<{ error: unknown } | null>(null)
  const handleBindingError = useCallback((error: unknown) => {
    setBindingFailure({ error })
  }, [])
  const { container, bindingCommitMarker, generation } = useBindingRoot(
    viewModel,
    parentGeneration,
    handleBindingError
  )

  if (bindingFailure !== null) {
    throw bindingFailure.error
  }

  return (
    <ScopeBindGenerationContext.Provider value={generation}>
      <div
        data-bind={`${DESCENDANT_BINDING_BOUNDARY}: true`}
        style={{ display: 'contents' }}
      >
        {bindingCommitMarker}
        <div
          ref={container as React.RefObject<HTMLDivElement>}
          style={{ display: 'contents' }}
        >
          {children}
        </div>
      </div>
    </ScopeBindGenerationContext.Provider>
  )
}) as <T>(props: Props<T>) => React.ReactElement
