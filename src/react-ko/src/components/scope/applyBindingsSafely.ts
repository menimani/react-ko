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

type BindingHandlerMethodFingerprints = {
  init?: string
  update?: string
  preprocess?: string
}

// These structural fingerprints come from Knockout 3.5.1's published build.
// They use arity plus property names and literals so bundler renaming is ignored.
// Unlike ko.bindingHandlers, they cannot be replaced before react-ko loads.
// A different handler implementation fails closed only when React owns children.
const CANONICAL_KNOCKOUT_BINDING_HANDLER_METHODS = new Map<
  string,
  BindingHandlerMethodFingerprints
>([
  ['attr', { update: '2:23:a84c6e9e:8b48f812' }],
  ['checked', { init: '3:55:2433ca9a:43e115a6' }],
  ['checkedValue', { update: '2:3:c6f6c6db:66bfbe4f' }],
  ['class', { update: '2:10:45f24797:93db470b' }],
  ['click', { init: '5:4:fe129414:cc7aa6f8' }],
  ['css', { update: '2:12:0f7f420b:7e9690a7' }],
  ['disable', { update: '2:5:55dbe217:a6cddbbb' }],
  ['enable', { update: '2:7:c79518e2:127851d6' }],
  ['event', { init: '5:18:06ba27b4:5189d2d0' }],
  [
    'hasFocus',
    {
      init: '3:25:e8553987:42de89a3',
      update: '2:16:a8b5f3ba:cbbf369e',
    },
  ],
  [
    'hasfocus',
    {
      init: '3:25:e8553987:42de89a3',
      update: '2:16:a8b5f3ba:cbbf369e',
    },
  ],
  ['hidden', { update: '2:5:24e9a882:da594dc6' }],
  ['let', { init: '5:2:81aa6587:f4cd58f3' }],
  [
    'selectedOptions',
    {
      init: '3:40:c0dc56d9:1998b265',
      update: '0:0:811c9dc5:9e3779b9',
    },
  ],
  ['style', { update: '2:18:2e828152:305618ee' }],
  ['submit', { init: '5:10:8242751b:a48426c7' }],
  ['textInput', { init: '3:44:e91ccd9e:3f56f17a' }],
  ['textinput', { preprocess: '3:1:f91bd5c2:f96a400e' }],
  ['uniqueName', { init: '2:6:e9d63526:d274950a' }],
  ['using', { init: '5:8:eaee5158:5ca6c27c' }],
  [
    'value',
    {
      init: '3:96:a0b37ed3:fe0c1e5f',
      update: '0:0:811c9dc5:9e3779b9',
    },
  ],
  ['visible', { update: '2:11:7f5f2c63:19ae2937' }],
])

function hashFunctionSource(source: string, seed: number) {
  let hash = seed >>> 0
  for (let index = 0; index < source.length; index += 1) {
    hash = Math.imul(hash ^ source.charCodeAt(index), 16777619) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

function methodFingerprint(method: unknown) {
  if (typeof method !== 'function') return undefined
  const source = Function.prototype.toString.call(method)
  const tokens = [
    ...source.matchAll(/(["'])(?:\\.|(?!\1).)*\1/g),
  ].map((match) =>
    match[0]
      .slice(1, -1)
      .replace(/\\(["'\\])/g, '$1')
  )
  tokens.push(
    ...[...source.matchAll(/\.\s*([A-Za-z_$][\w$]*)/g)].map(
      (match) => match[1]
    )
  )
  const shape = tokens.sort().join('\0')
  return [
    method.length,
    tokens.length,
    hashFunctionSource(shape, 0x811c9dc5),
    hashFunctionSource(shape, 0x9e3779b9),
  ].join(':')
}

function bindingHandlerMethodFingerprints(name: string) {
  const handler = ko.bindingHandlers[name]
  return handler === undefined
    ? undefined
    : {
        init: methodFingerprint(handler.init),
        update: methodFingerprint(handler.update),
        preprocess: methodFingerprint(handler.preprocess),
      }
}

const REACT_KO_BOUNDARY_HANDLER_METHODS = bindingHandlerMethodFingerprints(
  DESCENDANT_BINDING_BOUNDARY
)

function hasAuditedBindingHandler(name: string) {
  const registeredHandler = ko.bindingHandlers[name]
  const registeredMethods = bindingHandlerMethodFingerprints(name)
  const auditedMethods =
    name === DESCENDANT_BINDING_BOUNDARY
      ? REACT_KO_BOUNDARY_HANDLER_METHODS
      : CANONICAL_KNOCKOUT_BINDING_HANDLER_METHODS.get(name)
  return (
    (name.endsWith('Bubble') && registeredHandler === undefined) ||
    (REACT_CHILD_AUDITED_BINDINGS.has(name) &&
      (REACT_CHILD_HANDLERLESS_BINDINGS.has(name)
        ? registeredHandler === undefined
        : registeredHandler !== undefined &&
          auditedMethods !== undefined &&
          registeredMethods !== undefined &&
          registeredMethods.init === auditedMethods.init &&
          registeredMethods.update === auditedMethods.update &&
          registeredMethods.preprocess === auditedMethods.preprocess))
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
