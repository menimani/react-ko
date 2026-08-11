import ko from 'knockout'
import { version as reactVersion } from 'react'
import {
  DESCENDANT_BINDING_BOUNDARY,
  ensureDescendantBindingBoundary,
} from './descendantBindingBoundary'
import { prepareDescendantBindingContextCapture } from './descendantBindingContexts'

const REACT_UNSAFE_BINDINGS = new Set(['if', 'ifnot', 'foreach', 'template', 'with'])
const REACT_CHILD_UNSAFE_BINDINGS = new Set(['text', 'html', 'component', 'options'])
export const REACT_RENDERS_BIGINT = Number.parseInt(reactVersion, 10) >= 19

type BindingHandlerMethodFingerprints = {
  init?: string
  update?: string
  preprocess?: string
}

// Knockout 3.5.1 ships minified and debug distributions whose functions have
// different source shapes. Audit both published builds structurally so a
// handler replaced before react-ko loads cannot masquerade as a built-in.
const CANONICAL_KNOCKOUT_BINDING_HANDLER_METHODS = new Map<
  string,
  readonly BindingHandlerMethodFingerprints[]
>([
  ['attr', [
    { update: '2:23:a84c6e9e:8b48f812' },
    { update: '3:33:66f53797:81d8baab' },
  ]],
  ['checked', [
    { init: '3:55:2433ca9a:43e115a6' },
    { init: '3:67:a44820a9:e4056c0d' },
  ]],
  ['checkedValue', [
    { update: '2:3:c6f6c6db:66bfbe4f' },
    { update: '2:3:73f7bfab:940dc887' },
  ]],
  ['class', [
    { update: '2:10:45f24797:93db470b' },
    { update: '2:8:d4c5a246:7a23171a' },
  ]],
  ['click', [
    { init: '5:4:fe129414:cc7aa6f8' },
    { init: '5:4:259ff851:f2654795' },
  ]],
  ['component', [
    { init: '5:40:cac119ac:93938ac0' },
    { init: '5:47:651a11fe:9000aefa' },
  ]],
  ['css', [
    { update: '2:12:0f7f420b:7e9690a7' },
    { update: '2:12:058ba121:ec1524cd' },
  ]],
  ['disable', [
    { update: '2:5:55dbe217:a6cddbbb' },
    { update: '2:5:888e1afc:89ca67a8' },
  ]],
  ['enable', [
    { update: '2:7:c79518e2:127851d6' },
    { update: '2:7:ed6f5726:6f5b1b72' },
  ]],
  ['event', [
    { init: '5:18:06ba27b4:5189d2d0' },
    { init: '5:20:24a830af:4fc3204b' },
  ]],
  ['hasFocus', [
    {
      init: '3:25:e8553987:42de89a3',
      update: '2:16:a8b5f3ba:cbbf369e',
    },
    {
      init: '3:25:0c9b3501:5570a995',
      update: '2:16:8a46c2eb:ea0189c7',
    },
  ]],
  ['hasfocus', [
    {
      init: '3:25:e8553987:42de89a3',
      update: '2:16:a8b5f3ba:cbbf369e',
    },
    {
      init: '3:25:0c9b3501:5570a995',
      update: '2:16:8a46c2eb:ea0189c7',
    },
  ]],
  ['hidden', [
    { update: '2:5:24e9a882:da594dc6' },
    { update: '2:5:f376217b:ca069547' },
  ]],
  ['html', [
    {
      init: '0:0:811c9dc5:9e3779b9',
      update: '2:2:488e277f:9dc7d13b',
    },
    {
      init: '0:1:e8a0cdde:d8392512',
      update: '2:2:37da6727:de0d05c3',
    },
  ]],
  ['let', [
    { init: '5:2:81aa6587:f4cd58f3' },
    { init: '5:3:0c682be1:74d9be2d' },
  ]],
  ['options', [
    {
      init: '1:6:6bdc3c53:2b222427',
      update: '3:120:d9ec2df6:192824b2',
    },
    {
      init: '1:8:908b39cd:d9f21559',
      update: '3:131:e5baa33b:1dd07aa7',
    },
  ]],
  ['selectedOptions', [
    {
      init: '3:40:c0dc56d9:1998b265',
      update: '0:0:811c9dc5:9e3779b9',
    },
    {
      init: '3:41:c5717a44:f789cd00',
      update: '0:0:811c9dc5:9e3779b9',
    },
  ]],
  ['style', [
    { update: '2:18:2e828152:305618ee' },
    { update: '2:18:83ac6093:9164bc07' },
  ]],
  ['submit', [
    { init: '5:10:8242751b:a48426c7' },
    { init: '5:12:73f85f17:951e9e63' },
  ]],
  ['text', [
    {
      init: '0:0:811c9dc5:9e3779b9',
      update: '2:2:142f827a:897b15ee',
    },
    {
      init: '0:2:b3d55b14:c0e919c0',
      update: '2:2:b9f8fc9c:3663cd90',
    },
  ]],
  ['textInput', [
    { init: '3:44:e91ccd9e:3f56f17a' },
    { init: '3:99:325082c9:38fc00ed' },
  ]],
  ['textinput', [
    { preprocess: '3:1:f91bd5c2:f96a400e' },
  ]],
  ['uniqueName', [
    { init: '2:6:e9d63526:d274950a' },
    { init: '2:6:2443d96b:18d3dea7' },
  ]],
  ['using', [
    { init: '5:8:eaee5158:5ca6c27c' },
    { init: '5:11:a1086b64:0e881800' },
  ]],
  ['value', [
    {
      init: '3:96:a0b37ed3:fe0c1e5f',
      update: '0:0:811c9dc5:9e3779b9',
    },
    {
      init: '3:112:79dce598:927dd57c',
      update: '0:0:811c9dc5:9e3779b9',
    },
  ]],
  ['visible', [
    { update: '2:11:7f5f2c63:19ae2937' },
    { update: '2:11:62f5a449:003d57e5' },
  ]],
])

const CANONICAL_HANDLERLESS_BINDINGS = new Set([
  'optionsAfterRender',
  'optionsCaption',
  'optionsIncludeDestroyed',
  'optionsText',
  'optionsValue',
  'valueAllowUnset',
  'valueUpdate',
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
  const tokens = [...source.matchAll(/(["'])(?:\\.|(?!\1).)*\1/g)].map(
    (match) => match[0].slice(1, -1).replace(/\\(["'\\])/g, '$1')
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

export function hasCanonicalKnockoutBindingHandler(name: string) {
  const handler = ko.bindingHandlers[name]
  if (CANONICAL_HANDLERLESS_BINDINGS.has(name)) {
    return handler === undefined
  }

  const registered = bindingHandlerMethodFingerprints(name)
  return CANONICAL_KNOCKOUT_BINDING_HANDLER_METHODS.get(name)?.some(
    (canonical) =>
      registered !== undefined &&
      registered.init === canonical.init &&
      registered.update === canonical.update &&
      registered.preprocess === canonical.preprocess
  ) === true
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
  const innerHtml = reactInnerHtml(props)
  if (innerHtml !== undefined && innerHtml !== null && String(innerHtml) !== '') {
    return true
  }

  function hasRenderedPrimitive(child: unknown): boolean {
    if (typeof child === 'string') return child !== ''
    if (typeof child === 'number') return true
    if (typeof child === 'bigint') return REACT_RENDERS_BIGINT
    return Array.isArray(child) && child.some(hasRenderedPrimitive)
  }

  return hasRenderedPrimitive(props?.children)
}

function reactInnerHtml(props: ReactHostProps | null | undefined) {
  return (props?.dangerouslySetInnerHTML as { __html?: unknown } | undefined)?.__html
}

function reactOwnedVirtualBinding(element: Element): string | undefined {
  const innerHtml = reactInnerHtml(currentReactHostProps(element))
  if (innerHtml === undefined || innerHtml === null || String(innerHtml) === '') {
    return undefined
  }

  function visit(node: Node): string | undefined {
    if (node.nodeType === Node.COMMENT_NODE) {
      const source = /^\s*ko\s+([\s\S]*?)\s*$/.exec(node.nodeValue ?? '')?.[1]
      if (source !== undefined) {
        const binding = ko.expressionRewriting
          .parseObjectLiteral(source)
          .find(({ key }) => key !== undefined && REACT_UNSAFE_BINDINGS.has(key))
        if (binding?.key !== undefined) return binding.key
      }
    }

    for (const child of node.childNodes) {
      const binding = visit(child)
      if (binding !== undefined) return binding
    }
    return undefined
  }

  return visit(element)
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
    const unsafeBinding =
      reactOwnedVirtualBinding(element) ??
      [...names].find(
        (name) =>
          REACT_UNSAFE_BINDINGS.has(name) ||
          ((hasReactOwnedChildren(element) ||
            (element === root && rootHadReactContentMutation)) &&
            REACT_CHILD_UNSAFE_BINDINGS.has(name))
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
  ensureDescendantBindingBoundary()
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
