import {
  createElement,
  useCallback,
  useEffect,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import ko from 'knockout'
import { applyBindingsSafely } from './applyBindingsSafely'
import {
  observeBindingDescendants,
  prepareBindingDescendants,
  reconcileBindingDescendants,
  refreshBindingDescendantsAfterLayout,
  restoreDescendantBindingRoots,
} from './observeBindingDescendants'

type ActiveBinding = {
  node: HTMLElement
  viewModel: unknown
  parentGeneration: number
  stopObserving: () => void
}

const UNBOUND_BINDING = Symbol('unbound')

function BindingCommitMarker({
  onCommit,
  onActivate,
}: {
  onCommit: () => void
  onActivate: (marker: HTMLTemplateElement | null) => void
}) {
  useInsertionEffect(onCommit)
  return createElement('template', { ref: onActivate })
}

export function useBindingRoot(
  viewModel: unknown,
  parentGeneration: number,
  onError: (error: unknown) => void,
  notifyBindingEstablished = false,
  bindingIdentity: unknown = undefined
) {
  const container = useRef<HTMLElement | null>(null)
  const activeBinding = useRef<ActiveBinding | null>(null)
  const pendingBindingReplacement = useRef(false)
  const replacedBinding = useRef(false)
  const bindingEstablishedIdentity = useRef<unknown>(UNBOUND_BINDING)
  const synchronizeBindingForCommit = useRef(synchronizeBinding)
  const refreshInitialBinding = useRef(false)
  const [, setBindingEstablishedVersion] = useState(0)
  const [generation, setGeneration] = useState(0)

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
    const deferredSuspenseBindings = applyBindingsSafely(viewModel, node)
    const stopObserving = observeBindingDescendants(
      viewModel,
      node,
      onError,
      bindingStates,
      () => pendingBindingReplacement.current,
      deferredSuspenseBindings
    )
    activeBinding.current = { node, viewModel, parentGeneration, stopObserving }
    if (
      notifyBindingEstablished &&
      !Object.is(bindingEstablishedIdentity.current, bindingIdentity)
    ) {
      bindingEstablishedIdentity.current = bindingIdentity
      setBindingEstablishedVersion((current) => current + 1)
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
      if (
        active.node === node &&
        Object.is(active.viewModel, viewModel) &&
        active.parentGeneration === parentGeneration
      ) {
        pendingBindingReplacement.current = false
        // React has already committed data-bind changes by this phase. Retire
        // their old subscriptions before any descendant layout effect can run.
        reconcileBindingDescendants(active.node)
        return
      }

      disposeBinding()
      pendingBindingReplacement.current = false
      bind(node, true)
      return
    }

    bind(node, false)
  }

  // The inert template is the first child of the binding host. Its ref is
  // attached before later siblings run layout effects, and its parent is
  // already in the committed DOM even though the host's own ref is not.
  const bindingCommitMarker = createElement(BindingCommitMarker, {
    onCommit: () => {
      synchronizeBindingForCommit.current = synchronizeBinding
      const active = activeBinding.current
      pendingBindingReplacement.current =
        active !== null &&
        (!Object.is(active.viewModel, viewModel) ||
          active.parentGeneration !== parentGeneration)
    },
    onActivate: useCallback((marker: HTMLTemplateElement | null) => {
      if (marker === null || marker.parentElement === null) {
        return
      }
      container.current = marker.parentElement
      const hadActiveBinding = activeBinding.current !== null
      synchronizeBindingForCommit.current()
      refreshInitialBinding.current =
        !hadActiveBinding && activeBinding.current !== null
    }, []),
  })

  // On updates, refs are already attached and insertion effects run before all
  // layout effects. The layout pass remains as a fallback for the host ref and
  // for commits where the first-child marker did not attach.
  useInsertionEffect(synchronizeBinding)

  useLayoutEffect(() => {
    synchronizeBinding()

    if (replacedBinding.current) {
      replacedBinding.current = false
      setGeneration((current) => current + 1)
    }
  })

  // An enclosing component's layout effect runs after this root and can write
  // React-owned DOM. Refresh the initial pass after the whole layout phase so
  // Knockout ownership remains consistent without delaying descendant refs.
  useEffect(() => {
    if (!refreshInitialBinding.current) {
      synchronizeBinding()
      return
    }

    refreshInitialBinding.current = false
    const node = container.current
    if (node === null) return
    refreshBindingDescendantsAfterLayout(node)
  })

  useLayoutEffect(
    () => () => {
      disposeBinding()
    },
    []
  )

  return {
    container,
    bindingCommitMarker,
    generation,
    bindingEstablished: Object.is(
      bindingEstablishedIdentity.current,
      bindingIdentity
    ),
  }
}
