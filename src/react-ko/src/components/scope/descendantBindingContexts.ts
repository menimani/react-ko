import ko from 'knockout'
import { registerReactKoBindingHandler } from './bindingHandlerOwnership'

const CAPTURE_DESCENDANT_CONTEXT = 'reactKoCaptureDescendantContext'
const DESCENDANT_BINDING_CONTEXTS = Symbol.for('react-ko.descendantBindingContexts')
const CONTEXT_ESTABLISHING_BINDINGS = new Set(['let', 'using'])

type CaptureDescendantContextHandler = ko.BindingHandler & {
  [DESCENDANT_BINDING_CONTEXTS]: WeakMap<Node, ko.BindingContext<unknown>>
}

function descendantBindingContexts() {
  const registeredHandler =
    registerReactKoBindingHandler<CaptureDescendantContextHandler>(
      CAPTURE_DESCENDANT_CONTEXT,
      () => {
        const descendantBindingContexts = new WeakMap<
          Node,
          ko.BindingContext<unknown>
        >()

        return {
          [DESCENDANT_BINDING_CONTEXTS]: descendantBindingContexts,
          init: (
            element,
            _valueAccessor,
            _allBindings,
            _viewModel,
            bindingContext,
          ) => {
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
      },
    )
  return registeredHandler[DESCENDANT_BINDING_CONTEXTS]
}

function establishesDescendantContext(
  element: Element,
  validatedSources?: ReadonlyMap<Node, string>
) {
  const source =
    validatedSources?.get(element) ?? element.getAttribute('data-bind')
  if (source === null) {
    return false
  }

  return ko.expressionRewriting
    .parseObjectLiteral(source)
    .some(({ key }) => key !== undefined && CONTEXT_ESTABLISHING_BINDINGS.has(key))
}

export function isDescendantBindingContextCaptureMarker(node: Node) {
  return (
    node.nodeType === 1 &&
    (node as Element).getAttribute('data-bind') ===
      `${CAPTURE_DESCENDANT_CONTEXT}: true`
  )
}

export function descendantBindingContextCaptureBindings(accessors: boolean) {
  return accessors
    ? {
        // The capture handler intentionally never reads its value.
        [CAPTURE_DESCENDANT_CONTEXT]: /* v8 ignore next */ () => true,
      }
    : { [CAPTURE_DESCENDANT_CONTEXT]: true }
}

type RemoveContextMarkers = (() => void) & {
  captureProviderBindings(element: Element, bindingNames: Iterable<string>): void
}

/**
 * Adds short-lived binding markers that retain the exact context Knockout
 * creates for descendants of `using` and `let`, including empty elements.
 */
export function prepareDescendantBindingContextCapture(
  root: HTMLElement,
  validatedSources?: ReadonlyMap<Node, string>,
  excludedElements?: ReadonlySet<Element>
) {
  descendantBindingContexts()
  const candidates = [root, ...root.querySelectorAll<HTMLElement>('[data-bind]')]
  const markers: HTMLElement[] = []
  const markedElements = new WeakSet<Element>()

  function addMarker(element: Element) {
    if (excludedElements?.has(element) || markedElements.has(element)) {
      return
    }

    const marker = document.createElement('span')
    marker.setAttribute('data-bind', `${CAPTURE_DESCENDANT_CONTEXT}: true`)
    element.appendChild(marker)
    markers.push(marker)
    markedElements.add(element)
  }

  for (const element of candidates) {
    if (!establishesDescendantContext(element, validatedSources)) {
      continue
    }

    addMarker(element)
  }

  const removeMarkers = (() => {
    for (const marker of markers) {
      marker.remove()
    }
  }) as RemoveContextMarkers
  removeMarkers.captureProviderBindings = (element, bindingNames) => {
    for (const name of bindingNames) {
      if (CONTEXT_ESTABLISHING_BINDINGS.has(name)) {
        addMarker(element)
        return
      }
    }
  }
  return removeMarkers
}

export function descendantBindingContextFor(node: Node, root: Node) {
  const contexts = descendantBindingContexts()
  let ancestor = node.parentNode
  while (ancestor !== null && ancestor !== root) {
    const context = contexts.get(ancestor)
    if (context !== undefined) {
      return context
    }
    ancestor = ancestor.parentNode
  }

  return undefined
}
