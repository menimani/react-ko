import ko from 'knockout'
import { applyBindingsSafely } from './applyBindingsSafely'

// Observers on enclosing roots also see mutations inside nested scopes. Keep
// track of each binding root so only the nearest one handles an added subtree.
const bindingRoots = new WeakSet<Node>()

function belongsToBindingRoot(node: Node, root: Node) {
  if (!root.contains(node)) {
    return false
  }

  let ancestor = node.parentNode
  while (ancestor !== null && ancestor !== root) {
    if (bindingRoots.has(ancestor)) {
      return false
    }
    ancestor = ancestor.parentNode
  }

  return ancestor === root
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
export function observeBindingDescendants(viewModel: unknown, root: HTMLElement) {
  bindingRoots.add(root)

  const observer = new MutationObserver((records) => {
    cleanRemovedNodes(records, root)
    bindAddedNodes(records, root, viewModel)
  })
  observer.observe(root, { childList: true, subtree: true })

  return () => {
    // A removal and root unmount can happen before the observer callback. Drain
    // pending removals before disconnecting so subscriptions are not orphaned.
    const pendingRecords = observer.takeRecords()
    observer.disconnect()
    bindingRoots.delete(root)
    cleanRemovedNodes(pendingRecords, root)
  }
}
