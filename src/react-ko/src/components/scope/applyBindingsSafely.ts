import ko from 'knockout'
import { DESCENDANT_BINDING_BOUNDARY } from './descendantBindingBoundary'
import { prepareDescendantBindingContextCapture } from './descendantBindingContexts'

const REACT_UNSAFE_BINDINGS = new Set(['if', 'ifnot', 'foreach', 'template', 'with'])
const REACT_CHILD_UNSAFE_BINDINGS = new Set(['text', 'html', 'component', 'options'])
const REACT_CHILD_AUDITED_BINDINGS = new Set([
  'attr',
  'checked',
  'checkedValue',
  'childrenComplete',
  'class',
  'click',
  'component',
  'css',
  'descendantsComplete',
  'disable',
  'enable',
  'event',
  'foreach',
  'hasFocus',
  'hasfocus',
  'hidden',
  'html',
  'if',
  'ifnot',
  'let',
  'options',
  'optionsAfterRender',
  'optionsCaption',
  'optionsIncludeDestroyed',
  'optionsText',
  'optionsValue',
  'selectedOptions',
  'style',
  'submit',
  'template',
  'text',
  'textInput',
  'textinput',
  'uniqueName',
  'using',
  'value',
  'valueAllowUnset',
  'valueUpdate',
  'visible',
  'with',
  DESCENDANT_BINDING_BOUNDARY,
])
const REACT_CHILD_HANDLERLESS_BINDINGS = new Set([
  'childrenComplete',
  'descendantsComplete',
  'optionsAfterRender',
  'optionsCaption',
  'optionsIncludeDestroyed',
  'optionsText',
  'optionsValue',
  'valueAllowUnset',
  'valueUpdate',
])
function bindingHandlerMethods(name: string) {
  const handler = ko.bindingHandlers[name]
  return handler === undefined
    ? undefined
    : {
        init: handler.init,
        update: handler.update,
        preprocess: handler.preprocess,
      }
}

const REACT_CHILD_AUDITED_BINDING_HANDLER_METHODS = new Map(
  [...REACT_CHILD_AUDITED_BINDINGS].map((name) => [name, bindingHandlerMethods(name)])
)

function hasAuditedBindingHandler(name: string) {
  const registeredHandler = ko.bindingHandlers[name]
  const auditedMethods = REACT_CHILD_AUDITED_BINDING_HANDLER_METHODS.get(name)
  return (
    (name.endsWith('Bubble') && registeredHandler === undefined) ||
    (REACT_CHILD_AUDITED_BINDINGS.has(name) &&
      (REACT_CHILD_HANDLERLESS_BINDINGS.has(name)
        ? registeredHandler === undefined
        : registeredHandler !== undefined &&
          auditedMethods !== undefined &&
          registeredHandler.init === auditedMethods.init &&
          registeredHandler.update === auditedMethods.update &&
          registeredHandler.preprocess === auditedMethods.preprocess))
  )
}

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
  [name: string]: unknown
  children?: unknown
  dangerouslySetInnerHTML?: unknown
}

type ReactFiber = {
  stateNode?: unknown
  child?: ReactFiber | null
  sibling?: ReactFiber | null
  pendingProps?: ReactHostProps
  return?: ReactFiber | null
  alternate?: ReactFiber | null
}

function propsMatchDataBind(element: Element, props: ReactHostProps | undefined) {
  return (props?.['data-bind'] ?? null) === element.getAttribute('data-bind')
}

function committedFiber(fiber: ReactFiber | undefined): ReactFiber | undefined {
  if (fiber === undefined) return undefined

  let root = fiber
  while (root.return !== null && root.return !== undefined) {
    root = root.return
  }

  const currentRoot = (root.stateNode as { current?: ReactFiber } | null)?.current
  if (currentRoot === root) return fiber
  if (currentRoot === root.alternate) return fiber.alternate ?? undefined
  return undefined
}

export function currentReactHostProps(
  element: Element,
  preferWorkInProgress = false
): ReactHostProps | undefined {
  const propsKey = Object.getOwnPropertyNames(element).find((key) =>
    key.startsWith('__reactProps$')
  )
  const reactProps =
    propsKey === undefined
      ? undefined
      : ((element as unknown as Record<string, unknown>)[propsKey] as ReactHostProps)
  const fiberKey = Object.getOwnPropertyNames(element).find((key) =>
    key.startsWith('__reactFiber$')
  )
  const fiber =
    fiberKey === undefined
      ? undefined
      : ((element as unknown as Record<string, unknown>)[fiberKey] as ReactFiber)
  const current = committedFiber(fiber)

  if (preferWorkInProgress && current?.alternate?.pendingProps !== undefined) {
    return current.alternate.pendingProps
  }

  if (propsMatchDataBind(element, current?.pendingProps)) {
    return current?.pendingProps
  }

  // React mutates data-bind before switching the root's current fiber. During
  // that window select only the work-in-progress props matching the DOM.
  // Never combine both alternates: the other one can describe an older commit.
  const workInProgress = [fiber, fiber?.alternate].find((candidate) =>
    propsMatchDataBind(element, candidate?.pendingProps)
  )
  return workInProgress?.pendingProps ?? reactProps
}

function propsOwnUnfiberedContent(props: ReactHostProps | null | undefined): boolean {
  const innerHtml = (props?.dangerouslySetInnerHTML as { __html?: unknown } | undefined)?.__html
  if (innerHtml !== undefined && innerHtml !== null && String(innerHtml) !== '') {
    return true
  }

  function hasRenderedPrimitive(child: unknown): boolean {
    if (typeof child === 'string') return child !== ''
    if (typeof child === 'number' || typeof child === 'bigint') return true
    return Array.isArray(child) && child.some(hasRenderedPrimitive)
  }

  return hasRenderedPrimitive(props?.children)
}

function fiberOwnsNode(fiber: ReactFiber | null | undefined, nodes: ReadonlySet<Node>): boolean {
  for (let current = fiber; current !== null && current !== undefined; current = current.sibling) {
    if (nodes.has(current.stateNode as Node)) {
      return true
    }
    if (fiberOwnsNode(current.child, nodes)) {
      return true
    }
  }

  return false
}

export function hasReactOwnedChildren(
  element: Element,
  excludedChildren?: ReadonlySet<Node>
): boolean {
  const children = new Set(
    [...element.childNodes].filter((child) => !excludedChildren?.has(child))
  )

  const reactPropsKey = Object.getOwnPropertyNames(element).find((key) =>
    key.startsWith('__reactProps$')
  )
  if (reactPropsKey === undefined) {
    // applyBindingsSafely also accepts DOM assembled outside React. Treat its
    // existing children conservatively because their ownership is unknown.
    return children.size > 0
  }

  if (children.size === 0) {
    return false
  }

  const reactFiberKey = Object.getOwnPropertyNames(element).find((key) =>
    key.startsWith('__reactFiber$')
  )
  const reactFiber: ReactFiber | undefined =
    reactFiberKey === undefined
      ? undefined
      : ((element as unknown as Record<string, unknown>)[reactFiberKey] as ReactFiber)

  if (propsOwnUnfiberedContent(currentReactHostProps(element))) {
    return true
  }

  // Element instances are tagged before insertion. Text instances are not,
  // so find those by identity in the committed and work-in-progress fiber
  // trees. A component that renders null and other no-output children have no
  // matching host node. Knockout-written nodes have neither marker.
  return (
    [...children].some(hasReactTag) ||
    fiberOwnsNode(reactFiber?.child, children) ||
    fiberOwnsNode(reactFiber?.alternate?.child, children)
  )
}

/**
 * Rejects Knockout bindings that can clone, replace, or remove descendant
 * nodes owned by React. Descendant scopes validate their own trees, so an
 * ancestor must stop scanning at their binding boundaries.
 */
export function assertNoReactUnsafeBindings(
  root: HTMLElement,
  rootHadReactContentMutation = false
) {
  function visit(element: Element) {
    const names = bindingNames(element)
    const hasOwnedChildren =
      hasReactOwnedChildren(element) || (element === root && rootHadReactContentMutation)
    const unsafeBinding = [...names].find(
      (name) =>
        REACT_UNSAFE_BINDINGS.has(name) ||
        (hasOwnedChildren &&
          (REACT_CHILD_UNSAFE_BINDINGS.has(name) ||
            !hasAuditedBindingHandler(name)))
    )

    if (unsafeBinding !== undefined) {
      const advice = REACT_UNSAFE_BINDINGS.has(unsafeBinding)
        ? 'Use KoIf, KoIfNot, KoForeach, or KoWith instead.'
        : REACT_CHILD_UNSAFE_BINDINGS.has(unsafeBinding)
          ? 'Leave the bound element empty so Knockout can own its contents.'
          : 'Custom bindings on elements with React-owned children are not supported.'

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
