import ko from 'knockout'
import {
  applyBindingsSafely,
  assertNoReactUnsafeBindings,
  hasReactOwnedChildren,
} from './applyBindingsSafely'
import { descendantBindingContextFor } from './descendantBindingContexts'

// Observers on enclosing roots also see mutations inside nested scopes. Keep
// track of each binding root so only the nearest one handles a changed subtree.
// The view model registry also lets an ancestor attribute rebind restore any
// descendant roots that ko.cleanNode necessarily cleaned along with it.
const bindingRoots = new Map<HTMLElement, unknown>()
const bindingObservers = new Map<
  HTMLElement,
  { observer: MutationObserver; reconcile: (records: MutationRecord[]) => void }
>()
type AttributeInterceptor = {
  count: number
  setAttribute: typeof Element.prototype.setAttribute
  removeAttribute: typeof Element.prototype.removeAttribute
  interceptedSetAttribute: typeof Element.prototype.setAttribute
  interceptedRemoveAttribute: typeof Element.prototype.removeAttribute
}
const attributeInterceptors = new Map<typeof Element.prototype, AttributeInterceptor>()
const CONTENT_BINDINGS = new Set(['text', 'html', 'component', 'options'])

type BindingState = {
  source: string | null
  ownedContent: Set<Node> | null
}

function controlsElementContent(source: string | null) {
  if (source === null) {
    return false
  }

  return ko.expressionRewriting
    .parseObjectLiteral(source)
    .some(({ key }) => key !== undefined && CONTENT_BINDINGS.has(key))
}

function belongsToBindingRoot(node: Node, root: Node) {
  if (!root.contains(node)) {
    return false
  }

  let ancestor = node.parentNode
  while (ancestor !== null && ancestor !== root) {
    if (bindingRoots.has(ancestor as HTMLElement)) {
      return false
    }
    ancestor = ancestor.parentNode
  }

  return ancestor === root
}

function nearestBindingRoot(element: Element) {
  let nearest: HTMLElement | undefined

  for (const root of bindingObservers.keys()) {
    if (
      (root === element || root.contains(element)) &&
      (nearest === undefined || nearest.contains(root))
    ) {
      nearest = root
    }
  }

  return nearest
}

function reconcileChangedDataBind(element: Element, name: string) {
  if (name.toLowerCase() !== 'data-bind') {
    return
  }

  const root = nearestBindingRoot(element)
  if (root !== undefined) {
    reconcileBindingDescendants(root)
  }
}

function releaseAttributeInterceptor(prototype: typeof Element.prototype) {
  const interceptor = attributeInterceptors.get(prototype)
  if (interceptor === undefined) {
    return
  }

  interceptor.count -= 1
  if (interceptor.count !== 0) {
    return
  }

  if (prototype.setAttribute === interceptor.interceptedSetAttribute) {
    prototype.setAttribute = interceptor.setAttribute
  }
  if (prototype.removeAttribute === interceptor.interceptedRemoveAttribute) {
    prototype.removeAttribute = interceptor.removeAttribute
  }
  attributeInterceptors.delete(prototype)
}

function interceptDataBindChanges(root: HTMLElement) {
  const view = root.ownerDocument.defaultView
  if (view === null) {
    return () => undefined
  }

  const prototype = view.Element.prototype
  const existing = attributeInterceptors.get(prototype)
  if (existing !== undefined) {
    existing.count += 1
    return () => releaseAttributeInterceptor(prototype)
  }

  const setAttribute = prototype.setAttribute
  const removeAttribute = prototype.removeAttribute
  // MutationObserver callbacks run after layout effects, and a state update
  // below the binding root does not rerender that root. Drain the queued
  // data-bind record directly from React's attribute mutation in that case.
  const interceptedSetAttribute: typeof prototype.setAttribute = function (name, value) {
    setAttribute.call(this, name, value)
    reconcileChangedDataBind(this, name)
  }
  const interceptedRemoveAttribute: typeof prototype.removeAttribute = function (name) {
    removeAttribute.call(this, name)
    reconcileChangedDataBind(this, name)
  }
  prototype.setAttribute = interceptedSetAttribute
  prototype.removeAttribute = interceptedRemoveAttribute
  attributeInterceptors.set(prototype, {
    count: 1,
    setAttribute,
    removeAttribute,
    interceptedSetAttribute,
    interceptedRemoveAttribute,
  })

  return () => releaseAttributeInterceptor(prototype)
}

function addedBindingRoots(records: MutationRecord[], root: Node) {
  const addedRoots: HTMLElement[] = []

  for (const record of records) {
    for (const node of record.addedNodes) {
      if (
        node.nodeType === Node.ELEMENT_NODE &&
        belongsToBindingRoot(node, root) &&
        ko.contextFor(node) === undefined
      ) {
        addedRoots.push(node as HTMLElement)
      }
    }
  }

  return addedRoots
}

export function restoreDescendantBindingRoots(element: HTMLElement, ownerRoot: HTMLElement) {
  const descendantRoots = [...bindingRoots].filter(
    ([bindingRoot]) => bindingRoot !== ownerRoot && element.contains(bindingRoot)
  )

  // Registering layout effects is bottom-up, so Map insertion order can put a
  // child before its parent. Restore shallower roots first for stable scoping.
  descendantRoots.sort(([left], [right]) => {
    if (left.contains(right)) return -1
    if (right.contains(left)) return 1
    return 0
  })

  for (const [bindingRoot, viewModel] of descendantRoots) {
    applyBindingsSafely(viewModel, bindingRoot)
  }
}

function trackBindingTree(
  element: HTMLElement,
  ownerRoot: HTMLElement,
  bindingStates: WeakMap<HTMLElement, BindingState>
) {
  if (element !== ownerRoot && bindingRoots.has(element)) {
    return
  }

  const source = element.getAttribute('data-bind')
  bindingStates.set(element, {
    source,
    ownedContent: controlsElementContent(source) ? new Set(element.childNodes) : null,
  })

  for (const child of element.children) {
    trackBindingTree(child as HTMLElement, ownerRoot, bindingStates)
  }
}

function changedBindingElements(
  records: MutationRecord[],
  root: HTMLElement,
  addedRoots: HTMLElement[]
) {
  const changedElements = new Set<HTMLElement>()

  for (const record of records) {
    if (record.type !== 'attributes') {
      continue
    }

    const element = record.target as HTMLElement
    if (
      belongsToBindingRoot(element, root) &&
      !addedRoots.some((addedRoot) => addedRoot.contains(element))
    ) {
      changedElements.add(element)
    }
  }

  return changedElements
}

function refreshOwnedContent(
  records: MutationRecord[],
  changedElements: Set<HTMLElement>,
  bindingStates: WeakMap<HTMLElement, BindingState>
) {
  for (const record of records) {
    if (record.type !== 'childList' || record.target.nodeType !== Node.ELEMENT_NODE) {
      continue
    }

    const element = record.target as HTMLElement
    const state = bindingStates.get(element)
    if (state !== undefined && state.ownedContent !== null && !changedElements.has(element)) {
      // An element that was empty at bind time can gain React children later.
      // Reject before treating those nodes as content created by Knockout.
      assertNoReactUnsafeBindings(element)

      // While a content binding remains active, its direct children belong to
      // Knockout. Refresh the snapshot after text/html/component/options updates.
      state.ownedContent = new Set(element.childNodes)
    }
  }
}

function removeRetiredContent(
  element: HTMLElement,
  state: BindingState | undefined,
  addedRoots: HTMLElement[]
) {
  if (
    state === undefined ||
    !controlsElementContent(state.source) ||
    state.ownedContent === null
  ) {
    return
  }

  const hasNewReactChildren = addedRoots.some((addedRoot) => element.contains(addedRoot))
  const retiredNodes = hasReactOwnedChildren(element) || hasNewReactChildren
    ? state.ownedContent
    : new Set(element.childNodes)

  for (const node of retiredNodes) {
    // React may add its new children before it removes data-bind. Only remove
    // nodes captured while the previous Knockout content binding was active.
    if (node.parentNode === element) {
      element.removeChild(node)
    }
  }
}

function rebindChangedAttributes(
  changedElements: Set<HTMLElement>,
  root: HTMLElement,
  viewModel: unknown,
  bindingStates: WeakMap<HTMLElement, BindingState>,
  addedRoots: HTMLElement[]
) {
  for (const element of changedElements) {
    const previousState = bindingStates.get(element)
    const bindingContext =
      ko.contextFor(element) ?? descendantBindingContextFor(element, root) ?? viewModel
    ko.cleanNode(element)
    removeRetiredContent(element, previousState, addedRoots)
    applyBindingsSafely(bindingContext, element)
    trackBindingTree(element, root, bindingStates)
    restoreDescendantBindingRoots(element, root)
  }
}

function cleanRemovedNodes(records: MutationRecord[], root: Node) {
  for (const record of records) {
    for (const node of record.removedNodes) {
      // React reorders can report a removal followed by an insertion. Preserve
      // bindings while the same node remains under this binding root.
      if (!root.contains(node)) {
        ko.cleanNode(node)
      }
    }
  }
}

function bindAddedNodes(
  records: MutationRecord[],
  root: HTMLElement,
  viewModel: unknown,
  bindingStates: WeakMap<HTMLElement, BindingState>
) {
  for (const record of records) {
    for (const node of record.addedNodes) {
      if (
        node.nodeType !== Node.ELEMENT_NODE ||
        !belongsToBindingRoot(node, root) ||
        ko.contextFor(node) !== undefined
      ) {
        continue
      }

      // Binding the highest added element covers its subtree and respects any
      // descendant scope boundary encountered during that pass.
      const bindingContext = descendantBindingContextFor(node, root)
      applyBindingsSafely(bindingContext ?? viewModel, node as HTMLElement)
      trackBindingTree(node as HTMLElement, root, bindingStates)
    }
  }
}

/**
 * Binds React-owned elements added after the initial binding pass and disposes
 * their bindings when React removes them.
 */
export function observeBindingDescendants(
  viewModel: unknown,
  root: HTMLElement,
  onError: (error: unknown) => void
) {
  bindingRoots.set(root, viewModel)
  const bindingStates = new WeakMap<HTMLElement, BindingState>()
  trackBindingTree(root, root, bindingStates)

  const reconcile = (records: MutationRecord[]) => {
    cleanRemovedNodes(records, root)
    const addedRoots = addedBindingRoots(records, root)
    const changedElements = changedBindingElements(records, root, addedRoots)
    refreshOwnedContent(records, changedElements, bindingStates)
    rebindChangedAttributes(changedElements, root, viewModel, bindingStates, addedRoots)
    bindAddedNodes(records, root, viewModel, bindingStates)
  }
  const observer = new MutationObserver((records) => {
    try {
      reconcile(records)
    } catch (error) {
      observer.disconnect()
      onError(error)
    }
  })
  bindingObservers.set(root, { observer, reconcile })
  observer.observe(root, {
    attributeFilter: ['data-bind'],
    attributes: true,
    childList: true,
    subtree: true,
  })
  const stopIntercepting = interceptDataBindChanges(root)

  return () => {
    // A removal and root unmount can happen before the observer callback. Drain
    // pending removals before disconnecting so subscriptions are not orphaned.
    const pendingRecords = observer.takeRecords()
    observer.disconnect()
    bindingRoots.delete(root)
    bindingObservers.delete(root)
    stopIntercepting()
    cleanRemovedNodes(pendingRecords, root)
  }
}

/** Reconciles queued React DOM mutations before descendant layout effects run. */
export function reconcileBindingDescendants(root: HTMLElement) {
  const state = bindingObservers.get(root)
  if (state === undefined) {
    return
  }

  const records = state.observer.takeRecords()
  if (records.length === 0) {
    return
  }

  try {
    state.reconcile(records)
  } catch (error) {
    state.observer.disconnect()
    throw error
  }
}
