import React, { useRef, useLayoutEffect, useMemo } from 'react'
import ko from 'knockout'
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

  const appViewModel = useMemo(() => viewModel, [viewModel])

  useLayoutEffect(() => {
    if (koContainer.current === null) {
      return
    }
    if (isBoundRef.current === true) {
      return
    }
    ko.applyBindings(appViewModel, koContainer.current)
    isBoundRef.current = true
  }, [appViewModel])

  return (
    <AppViewModelContext.Provider value={appViewModel}>
      <ScopeViewModelContext.Provider value={appViewModel}>
        <div ref={koContainer} style={{ display: 'contents' }}>
          {children}
        </div>
      </ScopeViewModelContext.Provider>
    </AppViewModelContext.Provider>
  )
})
