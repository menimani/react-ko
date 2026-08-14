import ko from 'knockout'
import { version as reactVersion } from 'react'
import {
  DESCENDANT_BINDING_BOUNDARY,
  ensureDescendantBindingBoundary,
} from './descendantBindingBoundary'
import {
  descendantBindingContextCaptureBindings,
  isDescendantBindingContextCaptureMarker,
  prepareDescendantBindingContextCapture,
} from './descendantBindingContexts'
import {
  ELEMENT_BINDING_ROOT_ATTRIBUTE,
  isElementBindingRoot,
} from './elementBindingRoot'

const REACT_UNSAFE_BINDINGS = new Set(['if', 'ifnot', 'foreach', 'template', 'with'])
const REACT_CHILD_UNSAFE_BINDINGS = new Set(['text', 'html', 'component', 'options'])
export const REACT_RENDERS_BIGINT = Number.parseInt(reactVersion, 10) >= 19
const customDescendantControllers = new WeakMap<Element, string>()

export type DeferredSuspenseBinding = {
  start: Comment
  end: Comment
}

export function customDescendantControllerFor(element: Element) {
  return customDescendantControllers.get(element)
}

type BindingHandlerMethodFingerprints = {
  init?: readonly string[]
  update?: readonly string[]
  preprocess?: readonly string[]
}

// Audit the published minified and debug handler shapes without tying them to
// one exact compatible Knockout version. The selected tokens survive ordinary
// bundler renaming, while arbitrary same-arity replacements do not match.
const CANONICAL_KNOCKOUT_BINDING_HANDLER_FINGERPRINTS = new Map<
  string,
  BindingHandlerMethodFingerprints
>([
  ['attr', { update: ['2:14:9edaed42:cf30946e', '3:33:66f53797:81d8baab'] }],
  ['checked', { init: ['3:31:600f6b7a:324f7536', '3:67:a44820a9:e4056c0d'] }],
  ['checkedValue', { update: ['2:1:425ed3ca:bf5bee46', '2:3:73f7bfab:940dc887'] }],
  ['class', { update: ['2:5:2c4ad2b9:92515665', '2:8:d4c5a246:7a23171a'] }],
  ['click', { init: ['5:3:45e2c1e5:30675a19', '5:4:259ff851:f2654795'] }],
  ['component', { init: ['5:23:31734843:a6d62b97', '5:47:651a11fe:9000aefa'] }],
  ['css', { update: ['2:4:39e743ee:1c189fea', '2:12:058ba121:ec1524cd'] }],
  ['disable', { update: ['2:2:9340bf83:b90d7faf', '2:5:888e1afc:89ca67a8'] }],
  ['enable', { update: ['2:5:58e8c137:ec162fd3', '2:7:ed6f5726:6f5b1b72'] }],
  ['event', { init: ['5:13:6a71616f:5456b77b', '5:20:24a830af:4fc3204b'] }],
  ['hasFocus', {
    init: ['3:16:6f84dfc4:2cae98d8', '3:25:0c9b3501:5570a995'],
    update: ['2:11:925674a0:5611e23c', '2:16:8a46c2eb:ea0189c7'],
  }],
  ['hasfocus', {
    init: ['3:16:6f84dfc4:2cae98d8', '3:25:0c9b3501:5570a995'],
    update: ['2:11:925674a0:5611e23c', '2:16:8a46c2eb:ea0189c7'],
  }],
  ['hidden', { update: ['2:2:f0b6dd5e:dc53986a', '2:5:f376217b:ca069547'] }],
  ['html', {
    init: ['0:0:811c9dc5:9e3779b9', '0:1:e8a0cdde:d8392512'],
    update: ['2:1:6622ee8e:c393db2a', '2:2:37da6727:de0d05c3'],
  }],
  ['let', { init: ['5:2:81aa6587:f4cd58f3', '5:3:0c682be1:74d9be2d'] }],
  ['options', {
    init: ['1:4:2fd75a18:531299cc', '1:8:908b39cd:d9f21559'],
    update: ['3:74:2ffbccc7:d54b0e03', '3:129:e6d559bc:f22a15b0'],
  }],
  ['selectedOptions', {
    init: ['3:18:9f14d811:1d01b205', '3:41:c5717a44:f789cd00'],
    update: ['0:0:811c9dc5:9e3779b9'],
  }],
  ['style', { update: ['2:12:5307bda9:e0ae6c65', '2:18:83ac6093:9164bc07'] }],
  ['submit', { init: ['5:8:b30ea210:3d5cbb2c', '5:12:73f85f17:951e9e63'] }],
  ['text', {
    init: ['0:0:811c9dc5:9e3779b9', '0:2:b3d55b14:c0e919c0'],
    update: ['2:1:3edd8ca5:acd8db79', '2:2:b9f8fc9c:3663cd90'],
  }],
  ['textInput', { init: ['3:32:592e613b:66f7c257', '3:99:325082c9:38fc00ed'] }],
  ['textinput', { preprocess: ['3:1:f91bd5c2:f96a400e'] }],
  ['uniqueName', { init: ['2:4:bf118810:8cedc4c4', '2:6:2443d96b:18d3dea7'] }],
  ['using', { init: ['5:8:eaee5158:5ca6c27c', '5:11:a1086b64:0e881800'] }],
  ['value', {
    init: ['3:47:b72ee4fb:892fa38f', '3:112:79dce598:927dd57c'],
    update: ['0:0:811c9dc5:9e3779b9'],
  }],
  ['visible', { update: ['2:9:0889f096:e17a6fc2', '2:11:62f5a449:003d57e5'] }],
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
  const tokens = [...source.matchAll(/(["'])(?:\\.|(?!\1).)*\1/g)]
    .map((match) => match[0].slice(1, -1).replace(/\\(["'\\])/g, '$1'))
    // Bundlers may shorten their internal undefined sentinel to `u`.
    .filter((token) => token !== 'undefined' && token !== 'u')
  tokens.push(
    ...[...source.matchAll(/\.\s*([A-Za-z_$][\w$]*)/g)]
      .map((match) => match[1])
      // Single-letter properties are Knockout's private minified aliases and
      // can be renamed when Knockout is bundled with a consumer.
      .filter((token) => token.length > 1)
  )
  const shape = tokens.sort().join('\0')
  return [
    method.length,
    tokens.length,
    hashFunctionSource(shape, 0x811c9dc5),
    hashFunctionSource(shape, 0x9e3779b9),
  ].join(':')
}

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

function matchesMethodFingerprints(
  methods: ReturnType<typeof bindingHandlerMethods>,
  fingerprints: BindingHandlerMethodFingerprints
) {
  return methods !== undefined &&
    (['init', 'update', 'preprocess'] as const).every((name) => {
      const expected = fingerprints[name]
      const method = methods[name]
      return expected === undefined
        ? method === undefined
        : expected.includes(methodFingerprint(method) ?? '')
    })
}

const CANONICAL_KNOCKOUT_BINDING_HANDLER_METHODS = new Map(
  [...CANONICAL_KNOCKOUT_BINDING_HANDLER_FINGERPRINTS].flatMap(([name, fingerprints]) => {
    const methods = bindingHandlerMethods(name)
    return matchesMethodFingerprints(methods, fingerprints)
      ? [[name, methods] as const]
      : []
  })
)

export function hasCanonicalKnockoutBindingHandler(name: string) {
  const handler = ko.bindingHandlers[name]
  if (CANONICAL_HANDLERLESS_BINDINGS.has(name)) {
    return handler === undefined
  }

  const registered = bindingHandlerMethods(name)
  const canonical = CANONICAL_KNOCKOUT_BINDING_HANDLER_METHODS.get(name)
  return registered !== undefined &&
    canonical !== undefined &&
    registered.init === canonical.init &&
    registered.update === canonical.update &&
    registered.preprocess === canonical.preprocess
}

type ValidatedBindingSources = Map<Node, string>

function bindingNamesFromSource(
  source: string | null,
  node?: Node,
  validatedSources?: ValidatedBindingSources
): Set<string> {
  if (source === null) {
    return new Set()
  }

  const effectiveSource = ko.expressionRewriting.preProcessBindings(source)
  if (node !== undefined) {
    validatedSources?.set(node, effectiveSource)
  }
  return new Set(
    ko.expressionRewriting
      .parseObjectLiteral(effectiveSource)
      .flatMap(({ key }) => (key === undefined ? [] : [key]))
  )
}

function bindingNames(
  element: Element,
  validatedSources?: ValidatedBindingSources
): Set<string> {
  return bindingNamesFromSource(
    element.getAttribute('data-bind'),
    element,
    validatedSources
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

function propsMatchDirectContent(
  element: Element,
  props: ReactHostProps | undefined
) {
  const innerHtml = reactInnerHtml(props)
  if (innerHtml !== undefined && innerHtml !== null) {
    return element.innerHTML === String(innerHtml)
  }

  const children = props?.children
  return (
    (typeof children === 'string' ||
      typeof children === 'number' ||
      (typeof children === 'bigint' && REACT_RENDERS_BIGINT)) &&
    element.textContent === String(children)
  )
}

function propsMayRenderChildren(props: ReactHostProps | undefined): boolean {
  const innerHtml = reactInnerHtml(props)
  if (innerHtml !== undefined && innerHtml !== null) {
    return String(innerHtml) !== ''
  }

  function mayRender(child: unknown): boolean {
    if (typeof child === 'string') return child !== ''
    if (typeof child === 'number') return true
    if (typeof child === 'bigint') return REACT_RENDERS_BIGINT
    if (Array.isArray(child)) return child.some(mayRender)
    return child !== null && typeof child === 'object'
  }

  return mayRender(props?.children)
}

function hasReactTaggedDescendant(element: Element): boolean {
  function visit(node: Node): boolean {
    if (hasReactTag(node)) return true
    return [...node.childNodes].some(visit)
  }

  return [...element.childNodes].some(visit)
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

  if (preferWorkInProgress) {
    // React 18 and 19 can switch the root's current fiber on opposite sides
    // of a host mutation. Identify the render being committed from the DOM it
    // has already written instead of assuming that it is always `alternate`.
    const candidates = [current, current?.alternate, fiber, fiber?.alternate]
      .map((candidate) => candidate?.pendingProps)
      .filter(
        (props, index, all): props is ReactHostProps =>
          props !== undefined && all.indexOf(props) === index
      )
    const matchingContent = candidates.find((props) =>
      propsMatchDirectContent(element, props)
    )
    if (matchingContent !== undefined) return matchingContent
    const ownsTaggedContent = hasReactTaggedDescendant(element)
    const matchingPresence = candidates.filter(
      (props) => propsMayRenderChildren(props) === ownsTaggedContent
    )
    if (matchingPresence.length === 1) return matchingPresence[0]
    const matchingDataBind = candidates.filter((props) =>
      propsMatchDataBind(element, props)
    )
    if (matchingDataBind.length > 0) return matchingDataBind[0]
  }

  if (propsMatchDataBind(element, current?.pendingProps)) {
    return current?.pendingProps
  }

  // A host attribute can move ahead of the root's current fiber. During that
  // window select only the props whose data-bind value matches the DOM.
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

function reactOwnedVirtualBinding(
  element: Element,
  validatedSources?: ValidatedBindingSources
): string | undefined {
  const innerHtml = reactInnerHtml(currentReactHostProps(element))
  if (innerHtml === undefined || innerHtml === null || String(innerHtml) === '') {
    return undefined
  }

  function visit(node: Node): string | undefined {
    if (node.nodeType === Node.COMMENT_NODE) {
      const source = /^\s*ko\s+([\s\S]*?)\s*$/.exec(node.nodeValue ?? '')?.[1]
      if (source !== undefined) {
        const binding = [
          ...bindingNamesFromSource(source, node, validatedSources),
        ].find((name) => REACT_UNSAFE_BINDINGS.has(name))
        if (binding !== undefined) return binding
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
  rootHadReactContentMutation = false,
  includeDescendants = true
) {
  validateNoReactUnsafeBindings(
    root,
    rootHadReactContentMutation,
    includeDescendants
  )
}

function validateNoReactUnsafeBindings(
  root: HTMLElement,
  rootHadReactContentMutation = false,
  includeDescendants = true,
  useDefaultBindingSource = true,
  excludedElements?: ReadonlySet<Element>
) {
  const validatedSources: ValidatedBindingSources = new Map()

  function assertSafeBindings(
    element: Element,
    names: Set<string>,
    includeVirtualBindings = true
  ) {
    const unsafeBinding =
      (includeVirtualBindings
        ? reactOwnedVirtualBinding(element, validatedSources)
        : undefined) ??
      [...names].find(
        (name) =>
          REACT_UNSAFE_BINDINGS.has(name) ||
          ((hasReactOwnedChildren(element) ||
            (element === root && rootHadReactContentMutation)) &&
            REACT_CHILD_UNSAFE_BINDINGS.has(name))
      )

    if (unsafeBinding === undefined) return

    const advice = REACT_UNSAFE_BINDINGS.has(unsafeBinding)
      ? 'Use React rendering with useKoValue, useKoBind for a Knockout binding root, or KoForeach for lists instead.'
      : 'Leave the bound element empty so Knockout can own its contents.'

    throw new Error(
      `react-ko cannot apply the Knockout "${unsafeBinding}" binding because it controls React-owned child nodes. ` +
        advice
    )
  }

  function visit(element: Element) {
    if (excludedElements?.has(element)) return

    const names = useDefaultBindingSource
      ? bindingNames(element, validatedSources)
      : new Set<string>()
    assertSafeBindings(element, names, useDefaultBindingSource)

    const sourceNames = useDefaultBindingSource
      ? names
      : new Set(
          ko.expressionRewriting
            .parseObjectLiteral(element.getAttribute('data-bind') ?? '')
            .flatMap(({ key }) => (key === undefined ? [] : [key]))
        )
    if (element !== root && sourceNames.has(DESCENDANT_BINDING_BOUNDARY)) {
      return
    }

    if (!includeDescendants) return

    for (const child of element.children) {
      visit(child)
    }
  }

  visit(root)
  return {
    validatedSources,
    assertSafeProviderBindings: (element: Element, names: Set<string>) =>
      assertSafeBindings(element, names, false),
  }
}

function applyValidatedBindings(
  viewModel: unknown,
  node: HTMLElement,
  validatedSources: ValidatedBindingSources,
  assertSafeProviderBindings: (element: Element, names: Set<string>) => void,
  deferredBindings: readonly DeferredSuspenseBinding[],
  descendantRoots: ReadonlySet<HTMLElement>,
  captureProviderBindings: (
    element: Element,
    bindingNames: Iterable<string>
  ) => void
) {
  const provider = ko.bindingProvider.instance
  const getBindingAccessors = provider.getBindingAccessors
  const getBindings = provider.getBindings
  const providerWithBindingSource = provider as ko.IBindingProvider & {
    getBindingsString?: ko.bindingProvider['getBindingsString']
  }
  const validatingProvider = Object.create(provider) as ko.IBindingProvider & {
    getBindingsString?: ko.bindingProvider['getBindingsString']
  }
  const getBindingsString = providerWithBindingSource.getBindingsString
  const usesDefaultBindingSource =
    getBindingsString === ko.bindingProvider.prototype.getBindingsString

  function isDescendantRoot(bindingNode: Node) {
    return bindingNode !== node && descendantRoots.has(bindingNode as HTMLElement)
  }

  Object.defineProperty(validatingProvider, 'nodeHasBindings', {
    configurable: true,
    value: (bindingNode: Node) =>
      isDescendantBindingContextCaptureMarker(bindingNode) ||
      isDescendantRoot(bindingNode) ||
      provider.nodeHasBindings.call(provider, bindingNode),
    writable: true,
  })

  function validateProviderBindings(
    bindingNode: Node,
    bindings: ko.BindingAccessors | object | null | undefined
  ) {
    if (bindingNode !== node && !node.contains(bindingNode)) {
      return bindings
    }

    const element =
      bindingNode.nodeType === 1
        ? (bindingNode as Element)
        : bindingNode.nodeType === 8 && bindingNode.parentNode?.nodeType === 1
          ? (bindingNode.parentNode as Element)
          : undefined
    if (element !== undefined && bindings !== null && bindings !== undefined) {
      const names = new Set(Object.keys(bindings))
      assertSafeProviderBindings(element, names)
      captureProviderBindings(element, names)
    }
    return bindings
  }

  if (getBindingAccessors !== undefined) {
    if (getBindingsString !== undefined) {
      Object.defineProperty(validatingProvider, 'getBindingsString', {
        configurable: true,
        value: (bindingNode: Node, bindingContext: ko.BindingContext) =>
          validatedSources.get(bindingNode) ??
          getBindingsString.call(provider, bindingNode, bindingContext),
        writable: true,
      })
    }
    Object.defineProperty(validatingProvider, 'getBindingAccessors', {
      configurable: true,
      value: (bindingNode: Node, bindingContext: ko.BindingContext) => {
        if (isDescendantBindingContextCaptureMarker(bindingNode)) {
          return descendantBindingContextCaptureBindings(true)
        }
        if (isDescendantRoot(bindingNode)) {
          return {
            // The boundary handler intentionally never reads its value.
            [DESCENDANT_BINDING_BOUNDARY]: /* v8 ignore next */ () => true,
          }
        }
        const validatedSource = validatedSources.get(bindingNode)
        if (!usesDefaultBindingSource || validatedSource === undefined) {
          return validateProviderBindings(
            bindingNode,
            getBindingAccessors.call(provider, bindingNode, bindingContext)
          ) as ko.BindingAccessors
        }

        const getBindingHandler = ko.getBindingHandler
        ko.getBindingHandler = (name) => {
          const handler = getBindingHandler(name)
          return handler?.preprocess === undefined
            ? handler
            : (Object.assign(Object.create(handler), {
                preprocess: undefined,
              }) as ko.BindingHandler)
        }
        try {
          return validateProviderBindings(
            bindingNode,
            getBindingAccessors.call(
              validatingProvider,
              bindingNode,
              bindingContext
            )
          ) as ko.BindingAccessors
        } finally {
          ko.getBindingHandler = getBindingHandler
        }
      },
      writable: true,
    })
  } else if (getBindings !== undefined) {
    Object.defineProperty(validatingProvider, 'getBindings', {
      configurable: true,
      value: (bindingNode: Node, bindingContext: ko.BindingContext) => {
        if (isDescendantBindingContextCaptureMarker(bindingNode)) {
          return descendantBindingContextCaptureBindings(false)
        }
        if (isDescendantRoot(bindingNode)) {
          return { [DESCENDANT_BINDING_BOUNDARY]: true }
        }
        return validateProviderBindings(
          bindingNode,
          getBindings.call(provider, bindingNode, bindingContext)
        ) as object
      },
      writable: true,
    })
  }

  const suspenseMarkers = deferredBindings.flatMap(({ start, end }) => [
    [start, start.nodeValue] as const,
    [end, end.nodeValue] as const,
  ])
  // Knockout already understands virtual binding ranges. Temporarily present
  // React's dehydrated markers as our descendant boundary so its synchronous
  // traversal skips the untouched server nodes, then restore React's exact
  // marker data before either runtime can observe another turn.
  for (const [marker] of suspenseMarkers) {
    marker.nodeValue =
      deferredBindings.some(({ start }) => start === marker)
        ? `ko ${DESCENDANT_BINDING_BOUNDARY}: true`
        : '/ko'
  }
  ko.bindingProvider.instance = validatingProvider
  try {
    ko.applyBindings(viewModel, node)
  } finally {
    ko.bindingProvider.instance = provider
    for (const [marker, value] of suspenseMarkers) marker.nodeValue = value
  }
}

const SUSPENSE_START_MARKERS = new Set(['$', '$?', '$!'])

function matchingSuspenseEnd(start: Comment) {
  let depth = 0
  for (let node = start.nextSibling; node !== null; node = node.nextSibling) {
    if (node.nodeType !== Node.COMMENT_NODE) continue
    const marker = node.nodeValue
    if (marker !== null && SUSPENSE_START_MARKERS.has(marker)) {
      depth += 1
    } else if (marker === '/$') {
      if (depth === 0) return node as Comment
      depth -= 1
    }
  }
  return null
}

export function suspenseRangeElements(start: Comment, end: Comment) {
  const elements: Element[] = []

  function visit(node: Node) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      elements.push(node as Element)
    }
    for (const child of node.childNodes) visit(child)
  }

  for (let node = start.nextSibling; node !== null && node !== end; node = node.nextSibling) {
    visit(node)
  }
  return elements
}

export function findDehydratedSuspenseBindings(root: HTMLElement) {
  const deferred: DeferredSuspenseBinding[] = []

  function visit(parent: Node) {
    for (let node = parent.firstChild; node !== null; node = node.nextSibling) {
      if (
        node.nodeType === Node.COMMENT_NODE &&
        SUSPENSE_START_MARKERS.has(node.nodeValue ?? '')
      ) {
        const start = node as Comment
        const end = matchingSuspenseEnd(start)
        if (end !== null) {
          const elements = suspenseRangeElements(start, end)
          if (
            // React tags the Suspense marker before trying its client render,
            // but does not tag the server elements until hydration succeeds.
            hasReactTag(start) &&
            elements.length > 0 &&
            !elements.some(hasReactTag)
          ) {
            deferred.push({ start, end })
            node = end
            continue
          }
        }
      }

      visit(node)
    }
  }

  visit(root)
  return deferred
}

function deferredElements(bindings: readonly DeferredSuspenseBinding[]) {
  return new Set(
    bindings.flatMap(({ start, end }) => suspenseRangeElements(start, end))
  )
}

function rejectDescendantControllingCustomHandlers(root: HTMLElement) {
  const getBindingHandler = ko.getBindingHandler

  function virtualRangeSnapshot(start: Comment) {
    const parent = start.parentNode
    if (parent?.nodeType !== Node.ELEMENT_NODE) return undefined

    const rangeChildren = ko.virtualElements.childNodes(start)
    if (
      rangeChildren.length === 0 ||
      !hasReactOwnedChildren(parent as Element)
    ) {
      return undefined
    }

    // The custom init can remove the closing marker as well as its children.
    // Preserve the parent's exact node list so the whole virtual range can be
    // restored by identity before the rejected binding is cleaned.
    return {
      parent,
      children: [...parent.childNodes],
    }
  }

  ko.getBindingHandler = (name) => {
    const handler = getBindingHandler(name)
    const init = handler?.init
    if (
      init === undefined ||
      name === DESCENDANT_BINDING_BOUNDARY ||
      hasCanonicalKnockoutBindingHandler(name)
    ) {
      return handler
    }

    const detectingHandler = Object.create(handler) as ko.BindingHandler
    detectingHandler.init = (...args) => {
      const element = args[0]
      if (element !== root && !root.contains(element)) {
        return init(...args)
      }
      const virtualSnapshot =
        element.nodeType === Node.COMMENT_NODE
          ? virtualRangeSnapshot(element as Comment)
          : undefined
      const controlsReactOwnedChildren =
        virtualSnapshot !== undefined ||
        (element.nodeType === Node.ELEMENT_NODE &&
          hasReactOwnedChildren(element as Element))
      const originalChildren =
        element.nodeType === Node.ELEMENT_NODE && controlsReactOwnedChildren
          ? [...element.childNodes]
          : []
      const result = init(...args)
      if (result?.controlsDescendantBindings) {
        if (element.nodeType === 1) {
          customDescendantControllers.set(element as Element, name)
        }
        if (!controlsReactOwnedChildren) {
          return result
        }

        // Restore the direct React nodes if the rejected init moved or removed
        // them before reporting that it controls descendants.
        const childrenChanged =
          element.nodeType === Node.ELEMENT_NODE &&
          (element.childNodes.length !== originalChildren.length ||
            originalChildren.some(
              (child, index) => element.childNodes[index] !== child
            ))
        if (virtualSnapshot !== undefined) {
          virtualSnapshot.parent.replaceChildren(...virtualSnapshot.children)
        } else if (childrenChanged) {
          element.replaceChildren(...originalChildren)
        }
        throw new Error(
          `react-ko cannot apply the Knockout "${name}" binding because its custom handler controls React-owned child nodes. ` +
            'Custom bindings on elements with React-owned children must leave their descendants in place.'
        )
      }
      return result
    }
    return detectingHandler
  }

  return () => {
    ko.getBindingHandler = getBindingHandler
  }
}

/**
 * Applies a binding pass without leaving subscriptions behind when a later
 * binding on the same tree throws before React can register effect cleanup.
 */
export function applyBindingsSafely(
  viewModel: unknown,
  node: HTMLElement,
  descendantRoots: ReadonlySet<HTMLElement> = new Set()
) {
  const effectiveDescendantRoots = new Set([
    ...descendantRoots,
    ...Array.from(
      node.querySelectorAll<HTMLElement>(
        `[${ELEMENT_BINDING_ROOT_ATTRIBUTE}]`
      )
    ).filter((element) => element !== node && isElementBindingRoot(element)),
  ])

  function clearRecordedControllers(element: Element) {
    if (
      element !== node &&
      effectiveDescendantRoots.has(element as HTMLElement)
    ) return
    customDescendantControllers.delete(element)
    for (const child of element.children) clearRecordedControllers(child)
  }

  clearRecordedControllers(node)
  ensureDescendantBindingBoundary()
  const provider = ko.bindingProvider.instance as ko.IBindingProvider & {
    getBindingsString?: ko.bindingProvider['getBindingsString']
  }
  const usesDefaultBindingSource =
    provider.getBindingsString === ko.bindingProvider.prototype.getBindingsString
  const deferredBindings = findDehydratedSuspenseBindings(node)
  const excludedElements = new Set<Element>([
    ...deferredElements(deferredBindings),
    ...effectiveDescendantRoots,
  ])
  const { validatedSources, assertSafeProviderBindings } =
    validateNoReactUnsafeBindings(
      node,
      false,
      true,
      usesDefaultBindingSource,
      excludedElements
    )
  const removeContextMarkers = prepareDescendantBindingContextCapture(
    node,
    validatedSources,
    excludedElements
  )
  const restoreBindingHandlerLookup = rejectDescendantControllingCustomHandlers(node)
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
    applyValidatedBindings(
      viewModel,
      node,
      validatedSources,
      assertSafeProviderBindings,
      deferredBindings,
      effectiveDescendantRoots,
      removeContextMarkers.captureProviderBindings
    )
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
    restoreBindingHandlerLookup()
    removeContextMarkers()
  }

  return deferredBindings
}
