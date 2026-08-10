import ko from 'knockout'
import { DESCENDANT_BINDING_BOUNDARY } from './descendantBindingBoundary'
import { prepareDescendantBindingContextCapture } from './descendantBindingContexts'

const REACT_UNSAFE_BINDINGS = new Set(['if', 'ifnot', 'foreach', 'template', 'with'])
const REACT_CHILD_UNSAFE_BINDINGS = new Set(['text', 'html', 'component', 'options'])

function bindingNames(element: Element): Set<string> {
  const source = element.getAttribute('data-bind')
  if (source === null) {
    return new Set()
  }

  return new Set(
    ko.expressionRewriting
      .parseObjectLiteral(source)
      .flatMap(({ key }) => (key === undefined ? [] : [key]))
  )
}

function hasReactTag(node: Node): boolean {
  return Object.getOwnPropertyNames(node).some(
    (name) => name.startsWith('__reactFiber$') || name.startsWith('__reactProps$')
  )
}

type ReactHostProps = {
  children?: unknown
  dangerouslySetInnerHTML?: unknown
}

function propsOwnChildren(props: ReactHostProps | null | undefined): boolean {
  return (
    props?.dangerouslySetInnerHTML !== undefined ||
    (props?.children !== undefined && props.children !== null && props.children !== false)
  )
}

export function hasReactOwnedChildren(element: Element): boolean {
  if (!element.hasChildNodes()) {
    return false
  }

  const reactPropsKey = Object.getOwnPropertyNames(element).find((key) =>
    key.startsWith('__reactProps$')
  )
  if (reactPropsKey === undefined) {
    // applyBindingsSafely also accepts DOM assembled outside React. Treat its
    // existing children conservatively because their ownership is unknown.
    return true
  }

  const reactProps = (element as unknown as Record<string, unknown>)[reactPropsKey] as
    | ReactHostProps
    | undefined

  const reactFiberKey = Object.getOwnPropertyNames(element).find((key) =>
    key.startsWith('__reactFiber$')
  )
  const reactFiber =
    reactFiberKey === undefined
      ? undefined
      : ((element as unknown as Record<string, unknown>)[reactFiberKey] as {
          pendingProps?: ReactHostProps
          alternate?: { pendingProps?: ReactHostProps } | null
        })

  if (
    propsOwnChildren(reactProps) ||
    propsOwnChildren(reactFiber?.pendingProps) ||
    propsOwnChildren(reactFiber?.alternate?.pendingProps)
  ) {
    return true
  }

  // Element instances are tagged before insertion. Text instances are not,
  // so committed and work-in-progress host props above identify direct text.
  // Knockout-written nodes carry neither props nor a React tag.
  return [...element.childNodes].some(hasReactTag)
}

/**
 * Rejects Knockout bindings that can clone, replace, or remove descendant
 * nodes owned by React. Descendant scopes validate their own trees, so an
 * ancestor must stop scanning at their binding boundaries.
 */
export function assertNoReactUnsafeBindings(root: HTMLElement) {
  function visit(element: Element) {
    const names = bindingNames(element)
    const unsafeBinding = [...names].find(
      (name) =>
        REACT_UNSAFE_BINDINGS.has(name) ||
        (hasReactOwnedChildren(element) && REACT_CHILD_UNSAFE_BINDINGS.has(name))
    )

    if (unsafeBinding !== undefined) {
      const advice = REACT_UNSAFE_BINDINGS.has(unsafeBinding)
        ? 'Use KoIf, KoIfNot, KoForeach, or KoWith instead.'
        : 'Leave the bound element empty so Knockout can own its contents.'

      throw new Error(
        `react-ko cannot apply the Knockout "${unsafeBinding}" binding because it controls React-owned child nodes. ` +
          advice
      )
    }

    if (element !== root && names.has(DESCENDANT_BINDING_BOUNDARY)) {
      return
    }

    for (const child of element.children) {
      visit(child)
    }
  }

  visit(root)
}

/**
 * Applies a binding pass without leaving subscriptions behind when a later
 * binding on the same tree throws before React can register effect cleanup.
 */
export function applyBindingsSafely(viewModel: unknown, node: HTMLElement) {
  assertNoReactUnsafeBindings(node)
  const removeContextMarkers = prepareDescendantBindingContextCapture(node)
  const view = node.ownerDocument.defaultView
  const eventTargetPrototype = view?.EventTarget.prototype
  const addEventListener = eventTargetPrototype?.addEventListener

  // Knockout does not unregister native addEventListener handlers from nodes
  // that remain in the DOM after cleanNode. Track handlers created by this
  // binding pass so cleanup retires them before a replacement pass is applied.
  if (eventTargetPrototype !== undefined && addEventListener !== undefined && view !== null) {
    eventTargetPrototype.addEventListener = function (type, listener, options) {
      addEventListener.call(this, type, listener, options)

      if (listener !== null && this instanceof view.Node && (this === node || node.contains(this))) {
        ko.utils.domNodeDisposal.addDisposeCallback(this, () => {
          this.removeEventListener(type, listener, options)
        })
      }
    }
  }

  try {
    ko.applyBindings(viewModel, node)
  } catch (error) {
    try {
      ko.cleanNode(node)
    } finally {
      // Preserve the binding error even if cleanup itself fails.
      throw error
    }
  } finally {
    if (eventTargetPrototype !== undefined && addEventListener !== undefined) {
      eventTargetPrototype.addEventListener = addEventListener
    }
    removeContextMarkers()
  }
}
