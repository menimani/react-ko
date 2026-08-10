import ko from 'knockout'
import { applyBindingsSafely } from './applyBindingsSafely'

// Observers on enclosing roots also see mutations inside nested scopes. Keep
// track of each binding root so only the nearest one handles a changed subtree.
// The view model registry also lets an ancestor attribute rebind restore any
// descendant roots that ko.cleanNode necessarily cleaned along with it.
const bindingRoots = new Map<HTMLElement, unknown>()

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

function rebindChangedAttributes(
  records: MutationRecord[],
  root: HTMLElement,
  viewModel: unknown,
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

  for (const element of changedElements) {
    ko.cleanNode(element)
    applyBindingsSafely(viewModel, element)
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

function bindAddedNodes(records: MutationRecord[], root: Node, viewModel: unknown) {
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
      applyBindingsSafely(viewModel, node as HTMLElement)
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

  const observer = new MutationObserver((records) => {
    try {
      cleanRemovedNodes(records, root)
      const addedRoots = addedBindingRoots(records, root)
      rebindChangedAttributes(records, root, viewModel, addedRoots)
      bindAddedNodes(records, root, viewModel)
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
