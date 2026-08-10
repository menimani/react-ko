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

function restoreDescendantBindingRoots(element: HTMLElement, ownerRoot: HTMLElement) {
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

function removeRetiredContent(element: HTMLElement, state: BindingState | undefined) {
  if (
    state === undefined ||
    !controlsElementContent(state.source) ||
    state.ownedContent === null
  ) {
    return
  }

  const retiredNodes = hasReactOwnedChildren(element)
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
  bindingStates: WeakMap<HTMLElement, BindingState>
) {
  for (const element of changedElements) {
    const previousState = bindingStates.get(element)
    const bindingContext =
      ko.contextFor(element) ?? descendantBindingContextFor(element, root) ?? viewModel
    ko.cleanNode(element)
    removeRetiredContent(element, previousState)
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

  const observer = new MutationObserver((records) => {
    try {
      cleanRemovedNodes(records, root)
      const addedRoots = addedBindingRoots(records, root)
      const changedElements = changedBindingElements(records, root, addedRoots)
      refreshOwnedContent(records, changedElements, bindingStates)
      rebindChangedAttributes(changedElements, root, viewModel, bindingStates)
      bindAddedNodes(records, root, viewModel, bindingStates)
    } catch (error) {
      observer.disconnect()
      onError(error)
    }
  })
  observer.observe(root, {
    attributeFilter: ['data-bind'],
    attributes: true,
    childList: true,
    subtree: true,
  })

  return () => {
    // A removal and root unmount can happen before the observer callback. Drain
    // pending removals before disconnecting so subscriptions are not orphaned.
    const pendingRecords = observer.takeRecords()
    observer.disconnect()
    bindingRoots.delete(root)
    cleanRemovedNodes(pendingRecords, root)
  }
}
