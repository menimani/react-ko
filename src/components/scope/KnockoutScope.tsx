import * as React from 'react'
import { useLayoutEffect, useRef } from 'react'
import * as ko from 'knockout'
import { useAppViewModel } from '@/index'
import { ScopeViewModelContext } from '@/context/ScopeViewModelContext'

type Props<T> = {
  viewModel: T
  children: React.ReactNode
}

// Every scope's outer element carries this binding so an ancestor binding
// pass (the root provider or an enclosing scope) stops at the boundary
// instead of descending into DOM this scope binds itself.
const SCOPE_BOUNDARY = 'reactKoScopeBoundary'
if (ko.bindingHandlers[SCOPE_BOUNDARY] === undefined) {
  ko.bindingHandlers[SCOPE_BOUNDARY] = {
    init: () => ({ controlsDescendantBindings: true })
  }
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

  useLayoutEffect(() => {
    const node = container.current
    if (node === null) {
      return
    }
    ko.applyBindings(viewModel, node)

    return () => {
      ko.cleanNode(node)
    }
  }, [viewModel])

  return (
    <ScopeViewModelContext.Provider value={viewModel}>
      <div data-bind={`${SCOPE_BOUNDARY}: true`} style={{ display: 'contents' }}>
        <div ref={container} style={{ display: 'contents' }}>
          {children}
        </div>
      </div>
    </ScopeViewModelContext.Provider>
  )
})
