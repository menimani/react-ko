import { useCallback, useInsertionEffect, useLayoutEffect, useRef, useState } from 'react'
import ko from 'knockout'
import { applyBindingsSafely } from './applyBindingsSafely'
import {
  observeBindingDescendants,
  prepareBindingDescendants,
  reconcileBindingDescendants,
  restoreDescendantBindingRoots,
} from './observeBindingDescendants'

type ActiveBinding = {
  node: HTMLElement
  viewModel: unknown
  parentGeneration: number
  stopObserving: () => void
}

export function useBindingRoot(
  viewModel: unknown,
  parentGeneration: number,
  onError: (error: unknown) => void,
  notifyBindingEstablished = false
) {
  const container = useRef<HTMLElement | null>(null)
  const activeBinding = useRef<ActiveBinding | null>(null)
  const replacedBinding = useRef(false)
  const bindingEstablishedRef = useRef(false)
  const [bindingEstablished, setBindingEstablished] = useState(false)
  const [generation, setGeneration] = useState(0)
  const getBindingRoot = useCallback(
    () => activeBinding.current?.node ?? container.current,
    []
  )

  function disposeBinding() {
    const active = activeBinding.current
    if (active === null) {
      return
    }

    active.stopObserving()
    ko.cleanNode(active.node)
    activeBinding.current = null
  }

  function bind(node: HTMLElement, replacing: boolean) {
    const bindingStates = prepareBindingDescendants(node)
    applyBindingsSafely(viewModel, node)
    const stopObserving = observeBindingDescendants(
      viewModel,
      node,
      onError,
      bindingStates
    )
    activeBinding.current = { node, viewModel, parentGeneration, stopObserving }
    if (notifyBindingEstablished && !bindingEstablishedRef.current) {
      bindingEstablishedRef.current = true
      setBindingEstablished(true)
    }

    if (replacing) {
      // Cleaning an ancestor also cleans nested binding roots. Restore them now
      // so their layout effects never observe a temporarily unbound subtree.
      restoreDescendantBindingRoots(node, node)
      replacedBinding.current = true
    }
  }

  function synchronizeBinding() {
    const node = container.current
    if (node === null) {
      return
    }

    const active = activeBinding.current
    if (active !== null) {
      // React has already committed data-bind changes by this phase. Retire
      // their old subscriptions before any descendant layout effect can run.
      reconcileBindingDescendants(active.node)

      if (
        active.node === node &&
        Object.is(active.viewModel, viewModel) &&
        active.parentGeneration === parentGeneration
      ) {
        return
      }

      disposeBinding()
      bind(node, true)
      return
    }

    bind(node, false)
  }

  // On updates, refs are already attached and insertion effects run before all
  // layout effects. Initial binding remains in the layout phase because React
  // does not guarantee ref availability during insertion effects.
  useInsertionEffect(synchronizeBinding)

  useLayoutEffect(() => {
    synchronizeBinding()

    if (replacedBinding.current) {
      replacedBinding.current = false
      setGeneration((current) => current + 1)
    }
  })

  useLayoutEffect(
    () => () => {
      disposeBinding()
    },
    []
  )

  return {
    container,
    generation,
    bindingEstablished,
    getBindingRoot,
  }
}
