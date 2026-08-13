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
import {
  applyBindingsSafely,
  assertNoReactUnsafeBindings,
} from './applyBindingsSafely'
import {
  bindPendingDescendantRoots,
  cancelPendingBinding,
  deferBindingUntilAncestorBinds,
  observeBindingDescendants,
  prepareBindingDescendants,
  reconcileBindingDescendants,
  refreshBindingDescendantsAfterLayout,
  registerBindingRoot,
  restoreDescendantBindingRoots,
  unregisterBindingRoot,
} from './observeBindingDescendants'
import { portalBindingTargets } from './portalBindingRoots'

type ActiveRootBinding = {
  node: HTMLElement
  stopObserving: () => void
}

type ActiveBinding = {
  roots: ActiveRootBinding[]
  viewModel: unknown
  parentGeneration: number
}

const UNBOUND_BINDING = Symbol('unbound')

function BindingCommitMarker({
  onCommit,
  onActivate,
}: {
  onCommit: () => void
  onActivate: (node: HTMLElement | null) => void
}) {
  useInsertionEffect(onCommit)
  return createElement('template', {
    ref: (marker: HTMLTemplateElement | null) => {
      onActivate((marker?.nextElementSibling as HTMLElement | null) ?? null)
    },
  })
}

export function useBindingRoot(
  viewModel: unknown,
  parentGeneration: number,
  onError: (error: unknown) => void,
  notifyBindingEstablished = false,
  bindingIdentity: unknown = undefined
) {
  const containerNode = useRef<HTMLElement | null>(null)
  const activeBinding = useRef<ActiveBinding | null>(null)
  const pendingBindingReplacement = useRef(false)
  const replacedBinding = useRef(false)
  const bindingEstablishedIdentity = useRef<unknown>(UNBOUND_BINDING)
  const synchronizeBindingForCommit = useRef(synchronizeBinding)
  const refreshInitialBinding = useRef(false)
  const [, setBindingEstablishedVersion] = useState(0)
  const [generation, setGeneration] = useState(0)

  function disposeBinding() {
    const host = containerNode.current
    // A root waiting for an ancestor is dropped rather than left to bind into a tree
    // it is no longer part of.
    if (host !== null) cancelPendingBinding(host)

    const active = activeBinding.current
    if (active === null) {
      return
    }

    activeBinding.current = null
    for (const root of active.roots) {
      root.stopObserving()
    }
    for (const root of active.roots) {
      ko.cleanNode(root.node)
    }
  }

  function bindingRoots(node: HTMLElement) {
    const { containers, roots } = portalBindingTargets(node)
    for (const container of containers) {
      assertNoReactUnsafeBindings(container, false, false)
    }
    return [node, ...roots]
  }

  function bind(nodes: HTMLElement[], replacing: boolean) {
    for (const node of nodes) registerBindingRoot(node, viewModel)
    const roots: ActiveRootBinding[] = []
    activeBinding.current = {
      roots,
      viewModel,
      parentGeneration,
    }
    try {
      for (const node of nodes) {
        if (ko.contextFor(node) !== undefined) ko.cleanNode(node)
        const bindingStates = prepareBindingDescendants(node)
        const descendantRoots = new Set(
          nodes.filter((candidate) => candidate !== node && node.contains(candidate))
        )
        const deferredSuspenseBindings = applyBindingsSafely(
          viewModel,
          node,
          descendantRoots
        )
        const stopObserving = observeBindingDescendants(
          viewModel,
          node,
          onError,
          bindingStates,
          () => pendingBindingReplacement.current,
          deferredSuspenseBindings
        )
        roots.push({ node, stopObserving })
      }
    } catch (error) {
      disposeBinding()
      for (const node of nodes) unregisterBindingRoot(node)
      throw error
    }
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
      const activeRoots = new Set(nodes)
      const outermostRoots = nodes.filter(
        (node) => !nodes.some((candidate) => candidate !== node && candidate.contains(node))
      )
      for (const node of outermostRoots) {
        restoreDescendantBindingRoots(node, node, activeRoots)
      }
      replacedBinding.current = true
    }
  }

  function synchronizePortalRoots(node: HTMLElement, active: ActiveBinding) {
    const nodes = bindingRoots(node)
    const current = new Map(active.roots.map((root) => [root.node, root]))
    const removed = active.roots.filter((root) => !nodes.includes(root.node))

    for (const root of removed) root.stopObserving()
    for (const root of removed) {
      ko.cleanNode(root.node)
    }

    const added = nodes.filter((portalRoot) => !current.has(portalRoot))
    for (const portalRoot of added) registerBindingRoot(portalRoot, viewModel)

    const roots: ActiveRootBinding[] = []
    try {
      for (const portalRoot of nodes) {
        const existing = current.get(portalRoot)
        if (existing !== undefined && !removed.includes(existing)) {
          roots.push(existing)
          reconcileBindingDescendants(portalRoot)
          continue
        }

        if (ko.contextFor(portalRoot) !== undefined) ko.cleanNode(portalRoot)
        const bindingStates = prepareBindingDescendants(portalRoot)
        const descendantRoots = new Set(
          nodes.filter(
            (candidate) => candidate !== portalRoot && portalRoot.contains(candidate)
          )
        )
        const deferredSuspenseBindings = applyBindingsSafely(
          viewModel,
          portalRoot,
          descendantRoots
        )
        roots.push({
          node: portalRoot,
          stopObserving: observeBindingDescendants(
            viewModel,
            portalRoot,
            onError,
            bindingStates,
            () => pendingBindingReplacement.current,
            deferredSuspenseBindings
          ),
        })
      }
    } catch (error) {
      active.roots = roots
      disposeBinding()
      for (const portalRoot of added) unregisterBindingRoot(portalRoot)
      throw error
    }
    active.roots = roots
  }

  function synchronizeBinding() {
    const node = containerNode.current
    if (node === null) {
      return
    }

    // A caller that renders the bound element conditionally keeps this hook mounted
    // while the element itself leaves the document. Detaching a ref reports no reason,
    // so the removal is recognised here instead: a disconnected host can hold no live
    // binding, and rebinding it would leave subscriptions on a node nobody can see.
    // Checking the node rather than the ref call also leaves a same-commit re-attach
    // alone, where the ref is detached and reattached around a node that never left.
    if (!node.isConnected) {
      containerNode.current = null
      disposeBinding()
      return
    }

    const active = activeBinding.current
    if (active !== null) {
      if (
        active.roots[0]?.node === node &&
        Object.is(active.viewModel, viewModel) &&
        active.parentGeneration === parentGeneration
      ) {
        pendingBindingReplacement.current = false
        // React has already committed data-bind changes by this phase. Retire
        // their old subscriptions before any descendant layout effect can run.
        synchronizePortalRoots(node, active)
        return
      }

      disposeBinding()
      pendingBindingReplacement.current = false
      bindWhenAncestorsHave(node, true)
      return
    }

    bindWhenAncestorsHave(node, false)
  }

  /**
   * Knockout refuses a pass that reaches an already-bound element, and refuses it
   * before this library's own exclusions are consulted, so a root inside another one
   * cannot bind first. React attaches refs from the bottom up, which is exactly that
   * order, so a root whose ancestor is still waiting steps aside and is bound by the
   * ancestor once it has finished its own pass.
   */
  function bindWhenAncestorsHave(node: HTMLElement, replacing: boolean) {
    const run = () => {
      bind(bindingRoots(node), replacing)
      bindPendingDescendantRoots(node)
    }
    if (deferBindingUntilAncestorBinds(node, run)) return
    run()
  }

  // The inert template precedes the binding host inside the structural
  // boundary. Its ref is attached before the host's descendants run layout
  // effects without changing the caller-visible child subtree.
  const activateBindingHost = useCallback((node: HTMLElement | null) => {
    if (node === null) return
    containerNode.current = node
    const hadActiveBinding = activeBinding.current !== null
    synchronizeBindingForCommit.current()
    refreshInitialBinding.current =
      !hadActiveBinding && activeBinding.current !== null
  }, [])

  const bindingCommitMarker = createElement(BindingCommitMarker, {
    onCommit: () => {
      synchronizeBindingForCommit.current = synchronizeBinding
      const active = activeBinding.current
      pendingBindingReplacement.current =
        active !== null &&
        (!Object.is(active.viewModel, viewModel) ||
          active.parentGeneration !== parentGeneration)
    },
    onActivate: activateBindingHost,
  })

  // What the commit marker announces for a root that renders one: this binding is being
  // replaced, so the descendant observer must leave the subtree alone rather than rebind
  // a child against the view model on its way out. A root whose host comes from a
  // caller's ref renders no marker, and an effect is already too late -- the observer
  // reaches a child added by this commit first, and binds it against the outgoing view
  // model. Rendering happens before any of that, so the announcement is made here, and
  // withdrawn at the end of the commit -- see the layout effect below.
  {
    const active = activeBinding.current
    if (
      active !== null &&
      (!Object.is(active.viewModel, viewModel) ||
        active.parentGeneration !== parentGeneration)
    ) {
      pendingBindingReplacement.current = true
    }
  }

  // On updates, refs are already attached and insertion effects run before all
  // layout effects. The layout pass remains as a fallback for the host ref and
  // for commits where the first-child marker did not attach.
  useInsertionEffect(() => {
    // A caller that attaches the host from a ref of its own renders no commit marker,
    // so this is where its commit-time closure is refreshed. Insertion effects run in
    // the mutation phase and refs attach in the layout phase, so a host attached this
    // commit still binds against the view model this commit was rendered with rather
    // than the one the previous commit left behind.
    synchronizeBindingForCommit.current = synchronizeBinding
    synchronizeBinding()
  })

  useLayoutEffect(() => {
    synchronizeBinding()

    // The announcement raised during render covers this commit only. A replacement that
    // was rendered but never applied -- interrupted by Suspense, and still rendered on
    // every commit after -- would otherwise keep the observer muted for good, leaving a
    // child that arrives later unbound. Withdrawing it is not enough on its own: the
    // observer has already passed over that child, so the binding it skipped is taken up
    // here, against the view model the root is still bound to.
    if (pendingBindingReplacement.current) {
      pendingBindingReplacement.current = false
      for (const root of activeBinding.current?.roots ?? []) {
        reconcileBindingDescendants(root.node)
      }
    }

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
    const node = containerNode.current
    if (node === null) return
    for (const root of activeBinding.current?.roots ?? []) {
      refreshBindingDescendantsAfterLayout(root.node)
    }
  })

  useLayoutEffect(
    () => () => {
      disposeBinding()
    },
    []
  )

  return {
    container: containerNode,
    bindingContainer: activateBindingHost,
    bindingCommitMarker,
    generation,
    bindingEstablished: Object.is(
      bindingEstablishedIdentity.current,
      bindingIdentity
    ),
  }
}
