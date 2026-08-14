import * as React from 'react'
import { useCallback, useContext, useState } from 'react'
import { ScopeBindGenerationContext } from '@/context/ScopeBindGenerationContext'
import { ScopeViewModelContext } from '@/context/ScopeViewModelContext'
import { DESCENDANT_BINDING_BOUNDARY } from './descendantBindingBoundary'
import { useBindingRoot } from './useBindingRoot'

type Props<T> = {
  viewModel: T
  children: React.ReactNode
}

function KnockoutScopeComponent<T>({
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
    handleBindingError,
    true
  )

  if (bindingFailure !== null) {
    throw bindingFailure.error
  }

  return (
    <ScopeViewModelContext.Provider value={viewModel}>
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
    </ScopeViewModelContext.Provider>
  )
}

const MemoizedKnockoutScope = React.memo(KnockoutScopeComponent)

/**
 * Binds its children to the given view model and provides it through context.
 *
 * Unlike a root made with `useKoBind`, this component owns a position in the tree.
 * React attaches refs from the bottom up and runs a component's own effects after its
 * subtree's mutations, so a root taken from the caller's ref learns about its subtree
 * last. This component renders an inert marker before its host, and a first child's ref
 * and effects run before its siblings' -- which is what lets it bind an element that
 * arrives after it, and apply a replacement view model before the observer reaches a
 * child the same commit changed.
 *
 * This is the ordinary way to establish a Knockout scope. The hosts are plain divs with
 * `display: contents`: an element that has to be something else -- a row of a table, an
 * option of a select -- is the caller's own, through `useKoBind`.
 */
export function KnockoutScope<T>(props: Props<T>): React.ReactElement {
  return <MemoizedKnockoutScope {...props} />
}
