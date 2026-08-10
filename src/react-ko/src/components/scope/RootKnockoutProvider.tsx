import * as React from 'react'
import { useRef, useLayoutEffect, useState } from 'react'
import ko from 'knockout'
import { AppViewModelContext } from '@/index'
import { ScopeViewModelContext } from '@/context/ScopeViewModelContext'
import { ScopeBindGenerationContext } from '@/context/ScopeBindGenerationContext'
import { applyBindingsSafely } from './applyBindingsSafely'

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
  const [generation, setGeneration] = useState(0)
  const isFirstBind = useRef(true)

  useLayoutEffect(() => {
    const node = koContainer.current
    if (node === null) {
      return
    }
    applyBindingsSafely(viewModel, node)

    // Cleaning the root also disposes bindings owned by nested scopes. Let
    // the nearest scopes know that they must bind their descendants again.
    if (isFirstBind.current) {
      isFirstBind.current = false
    } else {
      setGeneration((current) => current + 1)
    }

    return () => {
      ko.cleanNode(node)
    }
  }, [viewModel])

  return (
    <AppViewModelContext.Provider value={viewModel}>
      <ScopeViewModelContext.Provider value={viewModel}>
        <ScopeBindGenerationContext.Provider value={generation}>
          <div ref={koContainer} style={{ display: 'contents' }}>
            {children}
          </div>
        </ScopeBindGenerationContext.Provider>
      </ScopeViewModelContext.Provider>
    </AppViewModelContext.Provider>
  )
})
