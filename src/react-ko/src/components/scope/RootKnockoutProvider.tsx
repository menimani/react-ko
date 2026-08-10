import * as React from 'react'
import { useRef, useLayoutEffect } from 'react'
import * as ko from 'knockout'
import { AppViewModelContext } from '@/index'
import { ScopeViewModelContext } from '@/context/ScopeViewModelContext'

type Props<T> = {
  viewModel: T
  children: React.ReactNode
}

/**
 * Applies Knockout bindings once on initial render,
 * and provides the ViewModel via context.
 */
export const RootKnockoutProvider = React.memo(function RootKnockoutProvider<T>({ viewModel, children }: Props<T>) {
  const koContainer = useRef<HTMLDivElement | null>(null)
  const isBoundRef = useRef(false)

  useLayoutEffect(() => {
    if (koContainer.current === null) {
      return
    }
    if (isBoundRef.current === true) {
      return
    }
    ko.applyBindings(viewModel, koContainer.current)
    isBoundRef.current = true
  }, [viewModel])

  return (
    <AppViewModelContext.Provider value={viewModel}>
      <ScopeViewModelContext.Provider value={viewModel}>
        <div ref={koContainer} style={{ display: 'contents' }}>
          {children}
        </div>
      </ScopeViewModelContext.Provider>
    </AppViewModelContext.Provider>
  )
})
