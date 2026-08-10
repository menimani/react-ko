import ko from 'knockout'

const CAPTURE_DESCENDANT_CONTEXT = 'reactKoCaptureDescendantContext'
const CONTEXT_ESTABLISHING_BINDINGS = new Set(['let', 'using'])
const descendantBindingContexts = new WeakMap<Node, ko.BindingContext<unknown>>()

if (ko.bindingHandlers[CAPTURE_DESCENDANT_CONTEXT] === undefined) {
  ko.bindingHandlers[CAPTURE_DESCENDANT_CONTEXT] = {
    init: (element, _valueAccessor, _allBindings, _viewModel, bindingContext) => {
      const parent = element.parentNode
      if (parent !== null) {
        descendantBindingContexts.set(parent, bindingContext)
        ko.utils.domNodeDisposal.addDisposeCallback(parent, () => {
          descendantBindingContexts.delete(parent)
        })
      }

      // Remove the marker before childrenComplete callbacks run and before
      // React can observe a node outside its own tree.
      element.remove()
    },
  }
}

function establishesDescendantContext(element: Element) {
  const source = element.getAttribute('data-bind')
  if (source === null) {
    return false
  }

  return ko.expressionRewriting
    .parseObjectLiteral(source)
    .some(({ key }) => key !== undefined && CONTEXT_ESTABLISHING_BINDINGS.has(key))
}

/**
 * Adds short-lived binding markers that retain the exact context Knockout
 * creates for descendants of `using` and `let`, including empty elements.
 */
export function prepareDescendantBindingContextCapture(root: HTMLElement) {
  const candidates = [root, ...root.querySelectorAll<HTMLElement>('[data-bind]')]
  const markers: HTMLElement[] = []

  for (const element of candidates) {
    if (!establishesDescendantContext(element)) {
      continue
    }

    const marker = document.createElement('span')
    marker.setAttribute('data-bind', `${CAPTURE_DESCENDANT_CONTEXT}: true`)
    element.appendChild(marker)
    markers.push(marker)
  }

  return () => {
    for (const marker of markers) {
      marker.remove()
    }
  }
}

export function descendantBindingContextFor(node: Node, root: Node) {
  let ancestor = node.parentNode
  while (ancestor !== null && ancestor !== root) {
    const context = descendantBindingContexts.get(ancestor)
    if (context !== undefined) {
      return context
    }
    ancestor = ancestor.parentNode
  }

  return undefined
}
