import ko from 'knockout'
import {
  applyBindingsSafely,
  assertNoReactUnsafeBindings,
  customDescendantControllerFor,
  currentReactHostProps,
  findDehydratedSuspenseBindings,
  hasCanonicalKnockoutBindingHandler,
  hasReactOwnedChildren,
  REACT_RENDERS_BIGINT,
  suspenseRangeElements,
  type DeferredSuspenseBinding,
} from './applyBindingsSafely'
import { hasReactKoBindingHandler } from './bindingHandlerOwnership'
import { descendantBindingContextFor } from './descendantBindingContexts'
import { DESCENDANT_BINDING_BOUNDARY } from './descendantBindingBoundary'
import { isElementBindingRoot } from './elementBindingRoot'

type BindingObserverState = {
  observer: MutationObserver
  bindingStates: BindingStateStore
  reconcile: (records: MutationRecord[], reactCommitInProgress?: boolean) => void
  shouldDeferReconciliation?: () => boolean
  shouldDeferDataBindChange: (element: Element) => boolean
  shouldDeferInsertion: (parent: Node) => boolean
  shouldReconcileDirectTextWrite: (
    element: HTMLElement,
    kind?: 'text' | 'html',
    value?: string
  ) => boolean
  refreshAfterLayout: () => void
  onError: (error: unknown) => void
}

type BindingRootRegistry = {
  bindingRoots: Map<HTMLElement, unknown>
  bindingObservers: Map<HTMLElement, BindingObserverState>
  reconcilingRoots: Set<HTMLElement>
  scheduledPropertyRoots: Set<HTMLElement>
  /**
   * Roots whose host is in the document but which are waiting for a root above them
   * to bind first. Knockout refuses a pass that reaches an already-bound element, and
   * refuses it before any of this library's exclusions are consulted, so an ancestor
   * has to bind before the roots inside it. React attaches refs from the bottom up,
   * which is the opposite order, and this is where that is put right.
   */
  pendingRoots: Map<HTMLElement, () => void>
}
type AttributeInterceptor = {
  owners: Map<InterceptorOwner, number>
  setAttribute: typeof Element.prototype.setAttribute
  removeAttribute: typeof Element.prototype.removeAttribute
  interceptedSetAttribute: typeof Element.prototype.setAttribute
  interceptedRemoveAttribute: typeof Element.prototype.removeAttribute
  formProperties: Array<{
    prototype: object
    name: string
    descriptor: PropertyDescriptor
    interceptedSet: (this: Element, value: unknown) => void
  }>
}
type TrackedCheckedInterceptor = {
  descriptor: PropertyDescriptor
  interceptedSet: (value: unknown) => void
}
const trackedCheckedInterceptors = new WeakMap<
  HTMLInputElement,
  TrackedCheckedInterceptor
>()
type ChildListInterceptor = {
  owners: Map<InterceptorOwner, number>
  appendChild: typeof Node.prototype.appendChild
  insertBefore: typeof Node.prototype.insertBefore
  replaceChild: typeof Node.prototype.replaceChild
  removeChild: typeof Node.prototype.removeChild
  interceptedAppendChild: typeof Node.prototype.appendChild
  interceptedInsertBefore: typeof Node.prototype.insertBefore
  interceptedReplaceChild: typeof Node.prototype.replaceChild
  interceptedRemoveChild: typeof Node.prototype.removeChild
}
type DirectTextInterceptor = {
  owners: Map<InterceptorOwner, number>
  properties: Array<{
    prototype: object
    name: string
    descriptor: PropertyDescriptor
    interceptedSet: (this: Node, value: unknown) => void
  }>
}
type InterceptorOwner = {
  reconcileChangedDataBind: (element: Element, name: string) => void
  reconcileChangedProperty: (element: Element) => void
  hasReactOwnership: (node: Node, parent?: Element) => boolean
  reconcileInsertedChildren: (parent: Node, reactOwned: boolean) => void
  reconcilePortalTopology: (
    parent: Node,
    added: Node | null,
    removed: Node | null
  ) => void
  reconcileDirectTextWrite: (
    node: Node,
    kind?: 'text' | 'html',
    value?: string
  ) => void
}
type PrototypeInterceptorRegistry = {
  attribute?: AttributeInterceptor
  childList?: ChildListInterceptor
  directText?: DirectTextInterceptor
  bindingRoots?: BindingRootRegistry
}
const INTERCEPTOR_REGISTRY = Symbol.for(
  'react-ko.observeBindingDescendants.prototypeInterceptors'
)

function interceptorRegistry(view: Window & typeof globalThis) {
  const registries = view as unknown as {
    [key: symbol]: PrototypeInterceptorRegistry | undefined
  }
  return (registries[INTERCEPTOR_REGISTRY] ??= {})
}

const detachedBindingRoots = createBindingRootRegistry()
const portalTopologyObservers = new Map<
  HTMLElement,
  (parent: Node, added: Node | null, removed: Node | null) => void
>()

export function observePortalTopology(
  root: HTMLElement,
  synchronize: (parent: Node, added: Node | null, removed: Node | null) => void
) {
  portalTopologyObservers.set(root, synchronize)
  return () => portalTopologyObservers.delete(root)
}

function createBindingRootRegistry(): BindingRootRegistry {
  return {
    bindingRoots: new Map(),
    bindingObservers: new Map(),
    reconcilingRoots: new Set(),
    scheduledPropertyRoots: new Set(),
    pendingRoots: new Map(),
  }
}

// Observers on enclosing roots also see mutations inside nested scopes. Keep
// ownership on the DOM window so independently loaded copies still dispatch a
// changed subtree to the globally nearest root. The view model registry also
// lets an ancestor rebind restore descendant roots cleaned along with it.
function bindingRootRegistry(node: Node) {
  const view = node.ownerDocument?.defaultView
  if (view == null) return detachedBindingRoots
  const registry = interceptorRegistry(view)
  return (registry.bindingRoots ??= createBindingRootRegistry())
}

/**
 * Whether a root above this host is in the document but has not bound yet.
 *
 * Only hosts marked as element binding roots are considered. A scope component binds
 * from a marker rendered before its host, which is early enough that it is already
 * bound by the time anything inside it attaches a ref, so it never has to be waited on.
 */
function unboundAncestorRoot(host: HTMLElement) {
  const registry = bindingRootRegistry(host)
  let ancestor = host.parentElement
  while (ancestor !== null) {
    if (isElementBindingRoot(ancestor) && !registry.bindingRoots.has(ancestor)) {
      return ancestor
    }
    ancestor = ancestor.parentElement
  }
  return undefined
}

/**
 * Holds a root back while a root above it is still waiting to bind, and reports
 * whether it was held. The caller binds immediately when it was not.
 */
export function deferBindingUntilAncestorBinds(host: HTMLElement, bind: () => void) {
  if (unboundAncestorRoot(host) === undefined) return false
  bindingRootRegistry(host).pendingRoots.set(host, bind)
  return true
}

/** Stops waiting: the host is gone, or its own root is being disposed. */
export function cancelPendingBinding(host: HTMLElement) {
  bindingRootRegistry(host).pendingRoots.delete(host)
}

/**
 * Binds the roots that were waiting inside this one, outermost first. Their own
 * descendants are picked up as each of them binds and releases the next level.
 */
export function bindPendingDescendantRoots(root: HTMLElement) {
  const registry = bindingRootRegistry(root)
  for (;;) {
    const ready = [...registry.pendingRoots.keys()].filter(
      (host) => root.contains(host) && unboundAncestorRoot(host) === undefined
    )
    if (ready.length === 0) return
    ready.sort((left, right) => (left.contains(right) ? -1 : right.contains(left) ? 1 : 0))
    for (const host of ready) {
      const bind = registry.pendingRoots.get(host)
      registry.pendingRoots.delete(host)
      bind?.()
    }
  }
}

function registeredDescendantRoots(element: HTMLElement) {
  return new Set(
    [...bindingRootRegistry(element).bindingRoots.keys()].filter(
      (root) => root !== element && element.contains(root)
    )
  )
}
const CONTENT_BINDINGS = new Set(['text', 'html', 'component', 'options'])
const SAFELY_RETIRABLE_BINDINGS = new Set([
  'attr',
  'checked',
  'checkedValue',
  'class',
  'click',
  'component',
  'css',
  'disable',
  'enable',
  'event',
  'hasFocus',
  'hasfocus',
  'html',
  'hidden',
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
  'text',
  'textInput',
  'uniqueName',
  'using',
  'value',
  'valueAllowUnset',
  'valueUpdate',
  'visible',
  DESCENDANT_BINDING_BOUNDARY,
])
const POST_LAYOUT_REFRESH_BINDINGS = new Set([
  'attr',
  'checked',
  'checkedValue',
  'class',
  'click',
  'css',
  'disable',
  'enable',
  'event',
  'hasFocus',
  'hasfocus',
  'hidden',
  'style',
  'submit',
  'textInput',
  'textinput',
  'uniqueName',
  'value',
  'visible',
])
const DELEGATED_BINDING_HANDLERS = new Map<string, readonly string[]>([
  ['checked', ['uniqueName']],
  ['click', ['event']],
  ['disable', ['enable']],
  ['hidden', ['visible']],
  ['textinput', ['textInput']],
])

type DomSnapshot = {
  attributes: Map<string, string>
  style: Map<string, { value: string; priority: string }>
  styleDisplay: string
  focused: boolean
  value?: unknown
  checked?: boolean
  disabled?: boolean
  selected?: boolean
}

type BindingState = {
  source: string | null
  customDescendantController: string | null
  ownedContent: Set<Node> | null
  ownedAttributes: Set<string>
  beforeBinding: DomSnapshot
  reactProps: Map<string, unknown>
  reactOwned: boolean
}

type BindingStateStore = WeakMap<HTMLElement, BindingState>

function rawBindingNames(source: string | null) {
  if (source === null) {
    return new Set<string>()
  }

  return new Set(
    ko.expressionRewriting
      .parseObjectLiteral(source)
      .flatMap(({ key }) => (key === undefined ? [] : [key]))
  )
}

function bindingNames(source: string | null) {
  return new Set(
    [...rawBindingNames(source)].map((name) =>
      name === 'textinput' ? 'textInput' : name
    )
  )
}

function snapshotDom(element: HTMLElement): DomSnapshot {
  const properties = element as HTMLElement & {
    value?: unknown
    checked?: boolean
    disabled?: boolean
    selected?: boolean
  }

  return {
    attributes: new Map([...element.attributes].map(({ name, value }) => [name, value])),
    style: new Map(
      Array.from({ length: element.style.length }, (_, index) =>
        element.style.item(index)
      ).map((name) => [
        name,
        {
          value: element.style.getPropertyValue(name),
          priority: element.style.getPropertyPriority(name),
        },
      ])
    ),
    styleDisplay: element.style.display,
    focused: element.ownerDocument.activeElement === element,
    ...('value' in properties ? { value: properties.value } : {}),
    ...('checked' in properties ? { checked: properties.checked } : {}),
    ...('disabled' in properties ? { disabled: properties.disabled } : {}),
    ...('selected' in properties ? { selected: properties.selected } : {}),
  }
}

function snapshotReactProps(element: HTMLElement) {
  const key = Object.getOwnPropertyNames(element).find((name) =>
    name.startsWith('__reactProps$')
  )
  const props =
    key === undefined
      ? undefined
      : (element as unknown as Record<string, unknown>)[key]
  if (props === null || typeof props !== 'object') {
    return new Map<string, unknown>()
  }

  return new Map(
    Object.entries(props as Record<string, unknown>).map(([name, value]) => [
      name,
      name === 'style' && value !== null && typeof value === 'object'
        ? { ...(value as Record<string, unknown>) }
        : name === 'value' && Array.isArray(value)
          ? [...value]
        : value,
    ])
  )
}

type ReactHostProps = Record<string, unknown>

type ReactHostFiber = {
  pendingProps?: ReactHostProps
  alternate?: ReactHostFiber | null
}

function reactHostFiber(element: Element): ReactHostFiber | undefined {
  const key = Object.getOwnPropertyNames(element).find((name) =>
    name.startsWith('__reactFiber$')
  )
  return key === undefined
    ? undefined
    : ((element as unknown as Record<string, unknown>)[key] as ReactHostFiber)
}

function directReactContent(props: ReactHostProps | ReadonlyMap<string, unknown> | undefined) {
  const get = (name: string) =>
    props instanceof Map
      ? props.get(name)
      : (props as ReactHostProps | undefined)?.[name]
  const innerHtml = (get('dangerouslySetInnerHTML') as { __html?: unknown } | undefined)
    ?.__html
  if (innerHtml !== undefined && innerHtml !== null) {
    return { kind: 'html', value: String(innerHtml) } as const
  }

  const children = get('children')
  if (
    typeof children === 'string' ||
    typeof children === 'number' ||
    (typeof children === 'bigint' && REACT_RENDERS_BIGINT)
  ) {
    return { kind: 'text', value: String(children) } as const
  }

  return null
}

function sameDirectReactContent(
  left: ReturnType<typeof directReactContent>,
  right: ReturnType<typeof directReactContent>
) {
  return (
    left === right ||
    (left !== null &&
      right !== null &&
      left.kind === right.kind &&
      left.value === right.value)
  )
}

function pendingDirectReactProps(
  element: HTMLElement,
  previousProps: ReadonlyMap<string, unknown>
) {
  const fiber = reactHostFiber(element)
  const candidates = [
    currentReactHostProps(element, true),
    fiber?.pendingProps,
    fiber?.alternate?.pendingProps,
    currentReactHostProps(element),
  ].filter(
    (props, index, all): props is ReactHostProps =>
      props !== undefined && all.indexOf(props) === index
  )
  const previous = directReactContent(previousProps)
  // Empty text and empty HTML have no DOM identity to distinguish their
  // removal from the previous render. In that case the candidate that differs
  // from the recorded props is the pending transition on both React majors.
  return (
    candidates.find(
      (props) =>
        (props['data-bind'] ?? null) === element.getAttribute('data-bind') &&
        !sameDirectReactContent(directReactContent(props), previous)
    ) ?? candidates[0]
  )
}

function hasDirectReactContentTransition(
  element: HTMLElement,
  previousProps: ReadonlyMap<string, unknown>,
  reactCommitInProgress: boolean
) {
  const previous = directReactContent(previousProps)
  const current = directReactContent(
    reactCommitInProgress
      ? pendingDirectReactProps(element, previousProps)
      : currentReactHostProps(element)
  )

  return (
    (previous !== null || current !== null) &&
    (previous === null ||
      current === null ||
      current.kind !== previous.kind ||
      current.value !== previous.value)
  )
}

function hasActiveDirectReactContentWrite(
  element: HTMLElement,
  previousProps: ReadonlyMap<string, unknown>,
  writtenKind?: 'text' | 'html',
  writtenValue?: string
) {
  const currentProps = currentReactHostProps(element, true)
  const current = directReactContent(currentProps)
  const renderedContent =
    writtenKind === undefined
      ? current?.kind === 'html'
        ? element.innerHTML
        : element.textContent
      : writtenValue

  // After a commit, the alternate describes the previous render but remains
  // reachable. A later Knockout content notification must not be mistaken for
  // that stale render: an active React write produces the pending content and
  // keeps the binding source currently reflected in the DOM.
  return (
    current !== null &&
    (writtenKind === undefined || current.kind === writtenKind) &&
    current.value === renderedContent &&
    (currentProps?.['data-bind'] ?? null) === element.getAttribute('data-bind') &&
    hasDirectReactContentTransition(element, previousProps, true)
  )
}

function prepareBindingTree(
  element: HTMLElement,
  root: HTMLElement,
  bindingStates: BindingStateStore
) {
  if (
    element !== root &&
    (bindingRootRegistry(root).bindingRoots.has(element) ||
      isElementBindingRoot(element))
  ) {
    return
  }

  bindingStates.set(element, {
    source: element.getAttribute('data-bind'),
    customDescendantController: null,
    ownedContent: null,
    ownedAttributes: new Set(),
    beforeBinding: snapshotDom(element),
    reactProps: snapshotReactProps(element),
    reactOwned: hasReactOwnership(element),
  })

  for (const child of element.children) {
    prepareBindingTree(child as HTMLElement, root, bindingStates)
  }
}

export function prepareBindingDescendants(root: HTMLElement): BindingStateStore {
  const bindingStates: BindingStateStore = new WeakMap()
  prepareBindingTree(root, root, bindingStates)
  return bindingStates
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

  let ancestor = node.nodeType === Node.ELEMENT_NODE ? node : node.parentNode
  while (ancestor !== null && ancestor !== root) {
    if (
      bindingRootRegistry(root).bindingRoots.has(ancestor as HTMLElement) ||
      (ancestor.nodeType === Node.ELEMENT_NODE &&
        isElementBindingRoot(ancestor as Element))
    ) {
      return false
    }
    ancestor = ancestor.parentNode
  }

  return ancestor === root
}

function nearestBindingRoot(element: Element) {
  let nearest: HTMLElement | undefined

  for (const root of bindingRootRegistry(element).bindingObservers.keys()) {
    if (
      (root === element || root.contains(element)) &&
      (nearest === undefined || nearest.contains(root))
    ) {
      nearest = root
    }
  }

  return nearest
}

function reconcileChangedDataBind(element: Element, name: string) {
  if (name.toLowerCase() !== 'data-bind') {
    return
  }

  const root = nearestBindingRoot(element)
  if (root !== undefined) {
    if (
      bindingRootRegistry(root).bindingObservers
        .get(root)
        ?.shouldDeferDataBindChange(element)
    ) {
      return
    }
    reconcileBindingDescendants(root)
  }
}

function hasReactOwnership(node: Node, parent?: Element): boolean {
  // React 18 and 19 tag host nodes before inserting them. Knockout-created
  // template nodes have no such tag and must remain on the asynchronous path.
  // Fiber-backed text keeps its tag after removal; optimized direct text has
  // no tag, so its host's committed or pending props decide.
  if (
    Object.getOwnPropertyNames(node).some(
      (name) => name.startsWith('__reactFiber$') || name.startsWith('__reactProps$')
    )
  ) {
    return true
  }

  if (node.nodeType === Node.TEXT_NODE && parent !== undefined) {
    return hasReactOwnedChildren(parent)
  }

  return [...node.childNodes].some((child) => hasReactOwnership(child))
}

function reconcileInsertedChildren(parent: Node, reactOwned: boolean) {
  if (parent.nodeType !== Node.ELEMENT_NODE) {
    return
  }

  const element = parent as Element
  if (!reactOwned && !hasReactOwnedChildren(element)) return

  const root = nearestBindingRoot(element)
  const registry = bindingRootRegistry(element)
  const state = root === undefined ? undefined : registry.bindingObservers.get(root)
  if (
    root !== undefined &&
    state !== undefined &&
    !state.shouldDeferInsertion(parent) &&
    !registry.reconcilingRoots.has(root)
  ) {
    reconcileBindingDescendants(root)
  }
}

function reconcilePortalTopology(
  parent: Node,
  added: Node | null,
  removed: Node | null
) {
  for (const synchronize of [...portalTopologyObservers.values()]) {
    synchronize(parent, added, removed)
  }
}

function reconcileDirectTextWrite(
  node: Node,
  kind?: 'text' | 'html',
  value?: string
) {
  const element =
    node.nodeType === Node.ELEMENT_NODE
      ? (node as HTMLElement)
      : node.parentElement
  if (element === null) return

  const root = nearestBindingRoot(element)
  const registry = bindingRootRegistry(element)
  const state = root === undefined ? undefined : registry.bindingObservers.get(root)
  if (
    root !== undefined &&
    state !== undefined &&
    state.shouldReconcileDirectTextWrite(element, kind, value) &&
    !registry.reconcilingRoots.has(root)
  ) {
    reconcileBindingDescendants(root)
  }
}

const interceptorOwner: InterceptorOwner = {
  reconcileChangedDataBind,
  reconcileChangedProperty,
  hasReactOwnership,
  reconcileInsertedChildren,
  reconcilePortalTopology,
  reconcileDirectTextWrite,
}

function addInterceptorOwner(owners: Map<InterceptorOwner, number>) {
  owners.set(interceptorOwner, (owners.get(interceptorOwner) ?? 0) + 1)
}

function releaseInterceptorOwner(owners: Map<InterceptorOwner, number>) {
  const count = owners.get(interceptorOwner)
  if (count === undefined) return false
  if (count > 1) {
    owners.set(interceptorOwner, count - 1)
    return false
  }
  owners.delete(interceptorOwner)
  return owners.size === 0
}

function releaseAttributeInterceptor(view: Window & typeof globalThis) {
  const registry = interceptorRegistry(view)
  const interceptor = registry.attribute
  if (interceptor === undefined) {
    return
  }

  if (!releaseInterceptorOwner(interceptor.owners)) {
    return
  }

  const prototype = view.Element.prototype
  if (prototype.setAttribute === interceptor.interceptedSetAttribute) {
    prototype.setAttribute = interceptor.setAttribute
  }
  if (prototype.removeAttribute === interceptor.interceptedRemoveAttribute) {
    prototype.removeAttribute = interceptor.removeAttribute
  }
  for (const {
    prototype: propertyPrototype,
    name,
    descriptor,
    interceptedSet,
  } of interceptor.formProperties) {
    if (Object.getOwnPropertyDescriptor(propertyPrototype, name)?.set === interceptedSet) {
      Object.defineProperty(propertyPrototype, name, descriptor)
    }
  }
  delete registry.attribute
}

function reconcileChangedProperty(element: Element) {
  const root = nearestBindingRoot(element)
  if (root === undefined) return
  const registry = bindingRootRegistry(root)
  if (registry.scheduledPropertyRoots.has(root)) return
  registry.scheduledPropertyRoots.add(root)
  queueMicrotask(() => {
    registry.scheduledPropertyRoots.delete(root)
    const state = registry.bindingObservers.get(root)
    if (state === undefined || registry.reconcilingRoots.has(root)) return
    registry.reconcilingRoots.add(root)
    try {
      state.reconcile([])
    } catch (error) {
      state.observer.disconnect()
      state.onError(error)
    } finally {
      registry.reconcilingRoots.delete(root)
    }
  })
}

function interceptReactTrackedChecked(element: HTMLElement) {
  const view = element.ownerDocument.defaultView
  if (
    view === null ||
    !(element instanceof view.HTMLInputElement) ||
    trackedCheckedInterceptors.has(element)
  ) {
    return
  }

  // React 18 tracks checked through an own property descriptor installed
  // before this root binds. Its setter closes over the original prototype
  // setter, so the prototype interceptor below cannot observe controlled
  // checkbox writes.
  const descriptor = Object.getOwnPropertyDescriptor(element, 'checked')
  if (descriptor?.set === undefined) return
  const set = descriptor.set
  const interceptedSet = function (this: HTMLInputElement, value: unknown) {
    set.call(this, value)
    reconcileChangedProperty(this)
  }
  Object.defineProperty(element, 'checked', {
    ...descriptor,
    set: interceptedSet,
  })
  trackedCheckedInterceptors.set(element, { descriptor, interceptedSet })
}

function releaseReactTrackedChecked(
  element: HTMLElement,
  ownerRoot?: HTMLElement
) {
  if (
    ownerRoot !== undefined &&
    element !== ownerRoot &&
    bindingRootRegistry(ownerRoot).bindingRoots.has(element)
  ) {
    return
  }

  const view = element.ownerDocument.defaultView
  if (view !== null && element instanceof view.HTMLInputElement) {
    const interceptor = trackedCheckedInterceptors.get(element)
    if (interceptor !== undefined) {
      if (
        Object.getOwnPropertyDescriptor(element, 'checked')?.set ===
        interceptor.interceptedSet
      ) {
        Object.defineProperty(element, 'checked', interceptor.descriptor)
      }
      trackedCheckedInterceptors.delete(element)
    }
  }

  for (const child of element.children) {
    releaseReactTrackedChecked(child as HTMLElement, ownerRoot)
  }
}

function interceptFormProperties(
  view: Window & typeof globalThis,
  owners: Map<InterceptorOwner, number>
) {
  const intercepted: AttributeInterceptor['formProperties'] = []
  const properties: Array<[object, string]> = [
    [view.HTMLInputElement.prototype, 'value'],
    [view.HTMLInputElement.prototype, 'checked'],
    [view.HTMLTextAreaElement.prototype, 'value'],
    [view.HTMLSelectElement.prototype, 'value'],
    [view.HTMLOptionElement.prototype, 'selected'],
  ]
  for (const [prototype, name] of properties) {
    const descriptor = Object.getOwnPropertyDescriptor(prototype, name)
    if (descriptor?.set === undefined) continue
    const set = descriptor.set
    const interceptedSet = function (this: Element, value: unknown) {
      set.call(this, value)
      for (const owner of owners.keys()) {
        owner.reconcileChangedProperty(this)
      }
    }
    Object.defineProperty(prototype, name, {
      ...descriptor,
      set: interceptedSet,
    })
    intercepted.push({ prototype, name, descriptor, interceptedSet })
  }
  return intercepted
}

function interceptDataBindChanges(root: HTMLElement) {
  const view = root.ownerDocument.defaultView
  if (view === null) {
    return () => undefined
  }

  const registry = interceptorRegistry(view)
  const prototype = view.Element.prototype
  const existing = registry.attribute
  if (existing !== undefined) {
    addInterceptorOwner(existing.owners)
    return () => releaseAttributeInterceptor(view)
  }

  const setAttribute = prototype.setAttribute
  const removeAttribute = prototype.removeAttribute
  const owners = new Map([[interceptorOwner, 1]])
  // MutationObserver callbacks run after layout effects, and a state update
  // below the binding root does not rerender that root. Drain the queued
  // data-bind record directly from React's attribute mutation in that case.
  const interceptedSetAttribute: typeof prototype.setAttribute = function (
    this: Element,
    name,
    value
  ) {
    setAttribute.call(this, name, value)
    for (const owner of owners.keys()) {
      owner.reconcileChangedDataBind(this, name)
    }
  }
  const interceptedRemoveAttribute: typeof prototype.removeAttribute = function (
    this: Element,
    name
  ) {
    removeAttribute.call(this, name)
    for (const owner of owners.keys()) {
      owner.reconcileChangedDataBind(this, name)
    }
  }
  prototype.setAttribute = interceptedSetAttribute
  prototype.removeAttribute = interceptedRemoveAttribute
  const formProperties = interceptFormProperties(view, owners)
  registry.attribute = {
    owners,
    setAttribute,
    removeAttribute,
    interceptedSetAttribute,
    interceptedRemoveAttribute,
    formProperties,
  }

  return () => releaseAttributeInterceptor(view)
}

function releaseChildListInterceptor(view: Window & typeof globalThis) {
  const registry = interceptorRegistry(view)
  const interceptor = registry.childList
  if (interceptor === undefined) {
    return
  }

  if (!releaseInterceptorOwner(interceptor.owners)) {
    return
  }

  const prototype = view.Node.prototype
  if (prototype.appendChild === interceptor.interceptedAppendChild) {
    prototype.appendChild = interceptor.appendChild
  }
  if (prototype.insertBefore === interceptor.interceptedInsertBefore) {
    prototype.insertBefore = interceptor.insertBefore
  }
  if (prototype.replaceChild === interceptor.interceptedReplaceChild) {
    prototype.replaceChild = interceptor.replaceChild
  }
  if (prototype.removeChild === interceptor.interceptedRemoveChild) {
    prototype.removeChild = interceptor.removeChild
  }
  delete registry.childList
}

function interceptChildListInsertions(root: HTMLElement) {
  const view = root.ownerDocument.defaultView
  if (view === null) {
    return () => undefined
  }

  const registry = interceptorRegistry(view)
  const prototype = view.Node.prototype
  const existing = registry.childList
  if (existing !== undefined) {
    addInterceptorOwner(existing.owners)
    return () => releaseChildListInterceptor(view)
  }

  const appendChild = prototype.appendChild
  const insertBefore = prototype.insertBefore
  const replaceChild = prototype.replaceChild
  const removeChild = prototype.removeChild
  const owners = new Map([[interceptorOwner, 1]])
  const interceptedAppendChild: typeof prototype.appendChild = function <T extends Node>(
    this: Node,
    child: T
  ): T {
    const parent = this.nodeType === Node.ELEMENT_NODE ? (this as Element) : undefined
    const ownership = Array.from(owners.keys(), (owner) => [
      owner,
      owner.hasReactOwnership(child, parent),
    ] as const)
    const inserted = appendChild.call(this, child) as T
    for (const [owner, reactOwned] of ownership) {
      owner.reconcileInsertedChildren(this, reactOwned)
      if (reactOwned) owner.reconcilePortalTopology(this, child, null)
    }
    return inserted
  }
  const interceptedInsertBefore: typeof prototype.insertBefore = function <T extends Node>(
    this: Node,
    child: T,
    referenceChild: Node | null
  ): T {
    const parent = this.nodeType === Node.ELEMENT_NODE ? (this as Element) : undefined
    const ownership = Array.from(owners.keys(), (owner) => [
      owner,
      owner.hasReactOwnership(child, parent),
    ] as const)
    const inserted = insertBefore.call(this, child, referenceChild) as T
    for (const [owner, reactOwned] of ownership) {
      owner.reconcileInsertedChildren(this, reactOwned)
      if (reactOwned) owner.reconcilePortalTopology(this, child, null)
    }
    return inserted
  }
  const interceptedReplaceChild: typeof prototype.replaceChild = function <T extends Node>(
    this: Node,
    child: Node,
    replacedChild: T
  ): T {
    const parent = this.nodeType === Node.ELEMENT_NODE ? (this as Element) : undefined
    const ownership = Array.from(owners.keys(), (owner) => [
      owner,
      owner.hasReactOwnership(child, parent),
    ] as const)
    const replaced = replaceChild.call(this, child, replacedChild) as T
    for (const [owner, reactOwned] of ownership) {
      owner.reconcileInsertedChildren(this, reactOwned)
      if (reactOwned) owner.reconcilePortalTopology(this, child, replacedChild)
    }
    return replaced
  }
  const interceptedRemoveChild: typeof prototype.removeChild = function <T extends Node>(
    this: Node,
    child: T
  ): T {
    const reactOwned = Array.from(owners.keys(), (owner) => [
      owner,
      owner.hasReactOwnership(child),
    ] as const)
    const removed = removeChild.call(this, child) as T
    for (const [owner, owned] of reactOwned) {
      if (owned) owner.reconcilePortalTopology(this, null, child)
    }
    return removed
  }
  prototype.appendChild = interceptedAppendChild
  prototype.insertBefore = interceptedInsertBefore
  prototype.replaceChild = interceptedReplaceChild
  prototype.removeChild = interceptedRemoveChild
  registry.childList = {
    owners,
    appendChild,
    insertBefore,
    replaceChild,
    removeChild,
    interceptedAppendChild,
    interceptedInsertBefore,
    interceptedReplaceChild,
    interceptedRemoveChild,
  }

  return () => releaseChildListInterceptor(view)
}

function releaseDirectTextInterceptor(view: Window & typeof globalThis) {
  const registry = interceptorRegistry(view)
  const interceptor = registry.directText
  if (interceptor === undefined) return

  if (!releaseInterceptorOwner(interceptor.owners)) return

  for (const {
    prototype: propertyPrototype,
    name,
    descriptor,
    interceptedSet,
  } of interceptor.properties) {
    if (Object.getOwnPropertyDescriptor(propertyPrototype, name)?.set === interceptedSet) {
      Object.defineProperty(propertyPrototype, name, descriptor)
    }
  }
  delete registry.directText
}

function interceptDirectTextWrites(root: HTMLElement) {
  const view = root.ownerDocument.defaultView
  if (view === null) return () => undefined

  const registry = interceptorRegistry(view)
  const prototype = view.Node.prototype
  const existing = registry.directText
  if (existing !== undefined) {
    addInterceptorOwner(existing.owners)
    return () => releaseDirectTextInterceptor(view)
  }

  const owners = new Map([[interceptorOwner, 1]])
  const properties: DirectTextInterceptor['properties'] = []
  // React can update direct text or HTML without calling a child-list method.
  // Observe every DOM setter it uses before sibling layout effects can notify
  // the content binding that still owns the host's current child nodes.
  for (const [propertyPrototype, name] of [
    [prototype, 'nodeValue'],
    [prototype, 'textContent'],
    [view.CharacterData.prototype, 'data'],
    [view.Element.prototype, 'innerHTML'],
  ] as Array<[object, string]>) {
    const descriptor = Object.getOwnPropertyDescriptor(propertyPrototype, name)
    if (descriptor?.set === undefined) continue
    const set = descriptor.set
    const interceptedSet = function (this: Node, value: unknown) {
      set.call(this, value)
      const kind = name === 'innerHTML' ? 'html' : 'text'
      const writtenValue = value === null || value === undefined ? '' : String(value)
      for (const owner of owners.keys()) {
        owner.reconcileDirectTextWrite(this, kind, writtenValue)
      }
    }
    Object.defineProperty(propertyPrototype, name, {
      ...descriptor,
      set: interceptedSet,
    })
    properties.push({ prototype: propertyPrototype, name, descriptor, interceptedSet })
  }
  registry.directText = { owners, properties }

  return () => releaseDirectTextInterceptor(view)
}

function isKnockoutOwnedContentAddition(
  record: MutationRecord,
  node: Node,
  bindingStates: BindingStateStore
) {
  if (record.target.nodeType !== Node.ELEMENT_NODE) {
    return false
  }

  const target = record.target as HTMLElement
  const state = bindingStates.get(target)
  // Content bindings own their output but do not bind its descendants. Keep
  // later output consistent with the initial binding pass.
  return (
    state !== undefined &&
    state.ownedContent !== null &&
    !hasReactOwnership(node, target)
  )
}

function addedBindingRoots(
  records: MutationRecord[],
  root: Node,
  bindingStates: BindingStateStore
) {
  const addedRoots: HTMLElement[] = []

  for (const record of records) {
    for (const node of record.addedNodes) {
      if (
        node.nodeType === Node.ELEMENT_NODE &&
        belongsToBindingRoot(node, root) &&
        ko.contextFor(node) === undefined &&
        !isKnockoutOwnedContentAddition(record, node, bindingStates)
      ) {
        addedRoots.push(node as HTMLElement)
      }
    }
  }

  return addedRoots
}

export function restoreDescendantBindingRoots(
  element: HTMLElement,
  ownerRoot: HTMLElement,
  excludedRoots: ReadonlySet<HTMLElement> = new Set()
) {
  const descendantRoots = [...bindingRootRegistry(ownerRoot).bindingRoots].filter(
    ([bindingRoot]) =>
      bindingRoot !== ownerRoot &&
      !excludedRoots.has(bindingRoot) &&
      element.contains(bindingRoot)
  )

  // Registering layout effects is bottom-up, so Map insertion order can put a
  // child before its parent. Restore shallower roots first for stable scoping.
  descendantRoots.sort(([left], [right]) => {
    if (left.contains(right)) return -1
    if (right.contains(left)) return 1
    return 0
  })

  for (const [bindingRoot, viewModel] of descendantRoots) {
    // The ancestor's pass marks every root inside it as a boundary, which leaves a
    // context on the node even though its own bindings are gone. Knockout refuses a
    // second pass over a node that holds one, so the mark is cleared first -- the same
    // thing a root does before binding a host it finds already carrying a context.
    if (ko.contextFor(bindingRoot) !== undefined) ko.cleanNode(bindingRoot)
    applyBindingsSafely(
      viewModel,
      bindingRoot,
      registeredDescendantRoots(bindingRoot)
    )
  }
}

function trackBindingTree(
  element: HTMLElement,
  ownerRoot: HTMLElement,
  bindingStates: BindingStateStore,
  excludedElements?: ReadonlySet<Element>
) {
  if (excludedElements?.has(element)) return
  if (
    element !== ownerRoot &&
    (bindingRootRegistry(ownerRoot).bindingRoots.has(element) ||
      isElementBindingRoot(element))
  ) {
    return
  }

  interceptReactTrackedChecked(element)

  const source = element.getAttribute('data-bind')
  const beforeBinding = bindingStates.get(element)?.beforeBinding ?? snapshotDom(element)
  const ownedAttributes = new Set<string>()
  const currentAttributes = new Map(
    [...element.attributes].map(({ name, value }) => [name, value])
  )
  for (const name of new Set([
    ...beforeBinding.attributes.keys(),
    ...currentAttributes.keys(),
  ])) {
    if (
      name !== 'data-bind' &&
      beforeBinding.attributes.get(name) !== currentAttributes.get(name)
    ) {
      ownedAttributes.add(name)
    }
  }
  const customDescendantController = customDescendantControllerFor(element) ?? null
  bindingStates.set(element, {
    source,
    customDescendantController,
    ownedContent:
      controlsElementContent(source) || customDescendantController !== null
        ? new Set(element.childNodes)
        : null,
    ownedAttributes,
    beforeBinding,
    reactProps: snapshotReactProps(element),
    reactOwned: hasReactOwnership(element),
  })

  for (const child of element.children) {
    trackBindingTree(
      child as HTMLElement,
      ownerRoot,
      bindingStates,
      excludedElements
    )
  }
}

function changedBindingElements(
  records: MutationRecord[],
  root: HTMLElement,
  addedRoots: HTMLElement[]
) {
  const changedElements = new Set<HTMLElement>()

  for (const record of records) {
    if (record.type !== 'attributes' || record.attributeName !== 'data-bind') {
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

function selectBindingDependsOnOptions(state: BindingState | undefined) {
  if (state === undefined) return false
  const names = bindingNames(state.source)
  return (
    names.has('selectedOptions') ||
    (names.has('value') && names.has('valueAllowUnset'))
  )
}

function changedOptionSelects(
  records: MutationRecord[],
  root: HTMLElement,
  bindingStates: BindingStateStore
) {
  const changed = new Set<HTMLElement>()

  const addOwningSelect = (element: Element) => {
    const select = element.closest('select') as HTMLElement | null
    if (
      select !== null &&
      belongsToBindingRoot(select, root) &&
      selectBindingDependsOnOptions(bindingStates.get(select))
    ) {
      changed.add(select)
    }
  }

  const addTextChangedOptionSelect = (
    node: Node,
    parent: Element,
    removed = false
  ) => {
    if (node.nodeType !== Node.TEXT_NODE) {
      return
    }

    const state = bindingStates.get(parent as HTMLElement)
    const previousContent =
      state === undefined ? null : directReactContent(state.reactProps)
    const removedReactText =
      removed &&
      state !== undefined &&
      previousContent?.kind === 'text' &&
      previousContent.value === node.nodeValue &&
      hasDirectReactContentTransition(
        parent as HTMLElement,
        state.reactProps,
        true
      )
    if (!hasReactOwnership(node, parent) && !removedReactText) return

    const option = parent.closest('option')
    if (option !== null && !option.hasAttribute('value')) {
      addOwningSelect(option)
    }
  }

  for (const record of records) {
    if (
      record.type === 'characterData' &&
      record.target.parentNode?.nodeType === Node.ELEMENT_NODE
    ) {
      addTextChangedOptionSelect(
        record.target,
        record.target.parentNode as Element
      )
    }

    if (record.type !== 'childList' || record.target.nodeType !== Node.ELEMENT_NODE) {
      continue
    }

    const parent = record.target as Element
    for (const node of record.addedNodes) {
      addTextChangedOptionSelect(node, parent)
    }
    for (const node of record.removedNodes) {
      addTextChangedOptionSelect(node, parent, true)
    }

    for (const node of record.addedNodes) {
      if (
        node.nodeType !== Node.ELEMENT_NODE ||
        !hasReactOwnership(node, parent)
      ) {
        continue
      }

      const element = node as Element
      if (element.tagName === 'OPTION' || element.querySelector('option') !== null) {
        addOwningSelect(element)
      }
    }

    const select = parent.closest('select') as HTMLElement | null
    const ownedContent =
      select === null ? null : bindingStates.get(select)?.ownedContent
    for (const node of record.removedNodes) {
      if (
        node.nodeType !== Node.ELEMENT_NODE ||
        ownedContent?.has(node) === true ||
        !(bindingStates.get(node as HTMLElement)?.reactOwned === true ||
          hasReactOwnership(node))
      ) {
        continue
      }

      const element = node as Element
      if (element.tagName === 'OPTION' || element.querySelector('option') !== null) {
        // Removed options are detached, so find their owning select through
        // the mutation target that remains in the React-owned tree.
        addOwningSelect(parent)
      }
    }
  }

  // React normally reflects an option value prop through the value attribute,
  // but the property interceptor can also schedule a record-free pass. Compare
  // host props so both paths reapply the binding without reacting to Knockout's
  // own DOM writes.
  for (const select of root.querySelectorAll('select')) {
    if (!selectBindingDependsOnOptions(bindingStates.get(select))) continue
    for (const option of select.querySelectorAll('option')) {
      const state = bindingStates.get(option)
      if (
        state !== undefined &&
        reactPropChanged(state.reactProps, snapshotReactProps(option), 'value')
      ) {
        changed.add(select)
        break
      }
    }
  }

  return changed
}

function recordOwnedAttributeChanges(
  records: MutationRecord[],
  bindingStates: BindingStateStore
) {
  for (const record of records) {
    const attributeName = mutationAttributeName(record)
    if (
      record.type !== 'attributes' ||
      attributeName === null ||
      attributeName === 'data-bind'
    ) {
      continue
    }

    const element = record.target as HTMLElement
    const state = bindingStates.get(element)
    if (state !== undefined && bindingNames(state.source).has('attr')) {
      state.ownedAttributes.add(attributeName)
    }
  }
}

function reactPropChanged(
  previous: Map<string, unknown>,
  current: Map<string, unknown>,
  name: string
) {
  const left = previous.get(name)
  const right = current.get(name)
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length !== right.length || left.some((value, index) => !Object.is(value, right[index]))
  }
  if (name !== 'style') return !Object.is(left, right)
  const keys = new Set([
    ...Object.keys((left as Record<string, unknown> | undefined) ?? {}),
    ...Object.keys((right as Record<string, unknown> | undefined) ?? {}),
  ])
  return [...keys].some((key) => stylePropChanged(left, right, key))
}

function stylePropChanged(previous: unknown, current: unknown, name: string) {
  const previousStyle =
    previous !== null && typeof previous === 'object'
      ? (previous as Record<string, unknown>)
      : {}
  const currentStyle =
    current !== null && typeof current === 'object'
      ? (current as Record<string, unknown>)
      : {}
  return !Object.is(previousStyle[name], currentStyle[name])
}

function cssPropertyName(name: string) {
  if (name.startsWith('--')) return name
  return name
    .replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
    .replace(/^ms-/, '-ms-')
}

const UNITLESS_STYLE_PROPERTIES = new Set([
  'animationIterationCount',
  'aspectRatio',
  'borderImageOutset',
  'borderImageSlice',
  'borderImageWidth',
  'boxFlex',
  'boxFlexGroup',
  'boxOrdinalGroup',
  'columnCount',
  'columns',
  'flex',
  'flexGrow',
  'flexNegative',
  'flexOrder',
  'flexPositive',
  'flexShrink',
  'fillOpacity',
  'floodOpacity',
  'fontWeight',
  'gridArea',
  'gridColumn',
  'gridColumnEnd',
  'gridColumnSpan',
  'gridColumnStart',
  'gridRow',
  'gridRowEnd',
  'gridRowSpan',
  'gridRowStart',
  'lineClamp',
  'lineHeight',
  'opacity',
  'order',
  'orphans',
  'scale',
  'stopOpacity',
  'strokeDasharray',
  'strokeDashoffset',
  'strokeMiterlimit',
  'strokeOpacity',
  'strokeWidth',
  'tabSize',
  'widows',
  'zIndex',
  'zoom',
])

function isUnitlessStyleProperty(name: string) {
  const unprefixed = name.replace(/^(?:Webkit|Moz|ms|O)/, '')
  return UNITLESS_STYLE_PROPERTIES.has(
    `${unprefixed.charAt(0).toLowerCase()}${unprefixed.slice(1)}`
  )
}

function updateStyleBaselineFromReactProps(
  state: BindingState,
  previous: unknown,
  current: unknown
) {
  const previousStyle =
    previous !== null && typeof previous === 'object'
      ? (previous as Record<string, unknown>)
      : {}
  const currentStyle =
    current !== null && typeof current === 'object'
      ? (current as Record<string, unknown>)
      : {}

  for (const name of new Set([...Object.keys(previousStyle), ...Object.keys(currentStyle)])) {
    if (!stylePropChanged(previous, current, name)) continue

    const cssName = cssPropertyName(name)
    const value = currentStyle[name]
    if (value === null || value === undefined || typeof value === 'boolean' || value === '') {
      state.beforeBinding.style.delete(cssName)
    } else {
      state.beforeBinding.style.set(cssName, {
        value:
          typeof value === 'number' &&
          value !== 0 &&
          !name.startsWith('--') &&
          !isUnitlessStyleProperty(name)
            ? `${value}px`
            : String(value).trim(),
        priority: '',
      })
    }
  }
}

const BOOLEAN_ATTRIBUTES = new Set([
  'allowFullScreen',
  'async',
  'autoFocus',
  'autoPlay',
  'checked',
  'controls',
  'default',
  'defer',
  'disablePictureInPicture',
  'disableRemotePlayback',
  'disabled',
  'formNoValidate',
  'hidden',
  'inert',
  'loop',
  'multiple',
  'muted',
  'noModule',
  'noValidate',
  'open',
  'playsInline',
  'readOnly',
  'required',
  'reversed',
  'scoped',
  'seamless',
  'itemScope',
])

const OVERLOADED_BOOLEAN_ATTRIBUTES = new Set(['capture', 'download'])

const REACT_PROP_ATTRIBUTE_ALIASES = new Map([
  ['acceptCharset', 'accept-charset'],
  ['className', 'class'],
  ['crossOrigin', 'crossorigin'],
  ['htmlFor', 'for'],
  ['httpEquiv', 'http-equiv'],
  ['accentHeight', 'accent-height'],
  ['alignmentBaseline', 'alignment-baseline'],
  ['arabicForm', 'arabic-form'],
  ['baselineShift', 'baseline-shift'],
  ['capHeight', 'cap-height'],
  ['clipPath', 'clip-path'],
  ['clipRule', 'clip-rule'],
  ['colorInterpolation', 'color-interpolation'],
  ['colorInterpolationFilters', 'color-interpolation-filters'],
  ['colorProfile', 'color-profile'],
  ['colorRendering', 'color-rendering'],
  ['dominantBaseline', 'dominant-baseline'],
  ['enableBackground', 'enable-background'],
  ['fillOpacity', 'fill-opacity'],
  ['fillRule', 'fill-rule'],
  ['floodColor', 'flood-color'],
  ['floodOpacity', 'flood-opacity'],
  ['fontFamily', 'font-family'],
  ['fontSize', 'font-size'],
  ['fontSizeAdjust', 'font-size-adjust'],
  ['fontStretch', 'font-stretch'],
  ['fontStyle', 'font-style'],
  ['fontVariant', 'font-variant'],
  ['fontWeight', 'font-weight'],
  ['glyphName', 'glyph-name'],
  ['glyphOrientationHorizontal', 'glyph-orientation-horizontal'],
  ['glyphOrientationVertical', 'glyph-orientation-vertical'],
  ['horizAdvX', 'horiz-adv-x'],
  ['horizOriginX', 'horiz-origin-x'],
  ['imageRendering', 'image-rendering'],
  ['letterSpacing', 'letter-spacing'],
  ['lightingColor', 'lighting-color'],
  ['markerEnd', 'marker-end'],
  ['markerMid', 'marker-mid'],
  ['markerStart', 'marker-start'],
  ['overlinePosition', 'overline-position'],
  ['overlineThickness', 'overline-thickness'],
  ['paintOrder', 'paint-order'],
  ['panose1', 'panose-1'],
  ['pointerEvents', 'pointer-events'],
  ['renderingIntent', 'rendering-intent'],
  ['shapeRendering', 'shape-rendering'],
  ['stopColor', 'stop-color'],
  ['stopOpacity', 'stop-opacity'],
  ['strikethroughPosition', 'strikethrough-position'],
  ['strikethroughThickness', 'strikethrough-thickness'],
  ['strokeDasharray', 'stroke-dasharray'],
  ['strokeDashoffset', 'stroke-dashoffset'],
  ['strokeLinecap', 'stroke-linecap'],
  ['strokeLinejoin', 'stroke-linejoin'],
  ['strokeMiterlimit', 'stroke-miterlimit'],
  ['strokeOpacity', 'stroke-opacity'],
  ['strokeWidth', 'stroke-width'],
  ['textAnchor', 'text-anchor'],
  ['textDecoration', 'text-decoration'],
  ['textRendering', 'text-rendering'],
  ['transformOrigin', 'transform-origin'],
  ['underlinePosition', 'underline-position'],
  ['underlineThickness', 'underline-thickness'],
  ['unicodeBidi', 'unicode-bidi'],
  ['unicodeRange', 'unicode-range'],
  ['unitsPerEm', 'units-per-em'],
  ['vAlphabetic', 'v-alphabetic'],
  ['vHanging', 'v-hanging'],
  ['vIdeographic', 'v-ideographic'],
  ['vMathematical', 'v-mathematical'],
  ['vectorEffect', 'vector-effect'],
  ['vertAdvY', 'vert-adv-y'],
  ['vertOriginX', 'vert-origin-x'],
  ['vertOriginY', 'vert-origin-y'],
  ['wordSpacing', 'word-spacing'],
  ['writingMode', 'writing-mode'],
  ['xlinkActuate', 'xlink:actuate'],
  ['xlinkArcrole', 'xlink:arcrole'],
  ['xlinkHref', 'xlink:href'],
  ['xlinkRole', 'xlink:role'],
  ['xlinkShow', 'xlink:show'],
  ['xlinkTitle', 'xlink:title'],
  ['xlinkType', 'xlink:type'],
  ['xmlBase', 'xml:base'],
  ['xmlLang', 'xml:lang'],
  ['xmlSpace', 'xml:space'],
  ['xmlnsXlink', 'xmlns:xlink'],
  ['xHeight', 'x-height'],
])

const ATTRIBUTE_NAMESPACE_PREFIXES = new Map([
  ['http://www.w3.org/1999/xlink', 'xlink'],
  ['http://www.w3.org/XML/1998/namespace', 'xml'],
  ['http://www.w3.org/2000/xmlns/', 'xmlns'],
])
const ATTRIBUTE_PREFIX_NAMESPACES = new Map(
  [...ATTRIBUTE_NAMESPACE_PREFIXES].map(([namespace, prefix]) => [prefix, namespace])
)

function mutationAttributeName(record: MutationRecord) {
  if (record.attributeName === null) return null
  const prefix =
    record.attributeNamespace === null
      ? undefined
      : ATTRIBUTE_NAMESPACE_PREFIXES.get(record.attributeNamespace)
  return prefix === undefined
    ? record.attributeName
    : `${prefix}:${record.attributeName}`
}

function reactAttributeValue(name: string, value: unknown) {
  if (value === null || value === undefined) return null
  if (BOOLEAN_ATTRIBUTES.has(name)) return value ? '' : null
  if (OVERLOADED_BOOLEAN_ATTRIBUTES.has(name)) {
    if (value === true) return ''
    if (value === false) return null
  }
  if (typeof value === 'function' || typeof value === 'symbol') return null
  return String(value)
}

function updateAttributeBaselineFromReactProp(
  state: BindingState,
  attributeName: string,
  propName: string,
  value: unknown
) {
  const serializationName =
    propName === 'defaultChecked' || propName === 'defaultValue'
      ? attributeName
      : propName
  const baseline = reactAttributeValue(serializationName, value)
  if (baseline === null) state.beforeBinding.attributes.delete(attributeName)
  else state.beforeBinding.attributes.set(attributeName, baseline)
}

function updateSelectedOptionsBaseline(
  element: HTMLSelectElement,
  value: unknown,
  bindingStates: BindingStateStore
) {
  if (value === null || value === undefined) return
  const values = new Set((Array.isArray(value) ? value : [value]).map(String))
  for (const option of element.options) {
    const optionState = bindingStates.get(option)
    if (optionState !== undefined) {
      optionState.beforeBinding.selected = values.has(option.value)
    }
  }
}

function reactPropForAttribute(
  attributeName: string,
  previous: Map<string, unknown>,
  current: Map<string, unknown>
) {
  const keys = new Set([...previous.keys(), ...current.keys()])
  return [...keys].find(
    (name) => {
      const attribute =
        name === 'defaultChecked'
          ? 'checked'
          : name === 'defaultValue'
            ? 'value'
            : REACT_PROP_ATTRIBUTE_ALIASES.get(name) ?? name
      return attribute.toLowerCase() === attributeName.toLowerCase()
    }
  )
}

function refreshReactOwnedDom(
  records: MutationRecord[],
  root: HTMLElement,
  bindingStates: BindingStateStore
) {
  const changed = new Set<HTMLElement>()

  for (const record of records) {
    const attributeName = mutationAttributeName(record)
    if (
      record.type !== 'attributes' ||
      attributeName === null ||
      attributeName === 'data-bind'
    ) {
      continue
    }
    const element = record.target as HTMLElement
    const state = bindingStates.get(element)
    if (state === undefined || !belongsToBindingRoot(element, root)) continue

    const names = bindingNames(state.source)
    const currentProps = snapshotReactProps(element)
    const reactProp = reactPropForAttribute(
      attributeName,
      state.reactProps,
      currentProps
    )
    const propsChanged =
      reactProp !== undefined && reactPropChanged(state.reactProps, currentProps, reactProp)
    if (!propsChanged || reactProp === undefined) continue

    if (
      attributeName === 'class' &&
      (names.has('class') || names.has('css'))
    ) {
      updateAttributeBaselineFromReactProp(
        state,
        'class',
        reactProp,
        currentProps.get(reactProp)
      )
      changed.add(element)
    } else if (
      attributeName === 'style' &&
      (names.has('style') || names.has('visible') || names.has('hidden')) &&
      (names.has('style') ||
        stylePropChanged(
          state.reactProps.get('style'),
          currentProps.get('style'),
          'display'
        ))
    ) {
      updateStyleBaselineFromReactProps(
        state,
        state.reactProps.get('style'),
        currentProps.get('style')
      )
      state.beforeBinding.styleDisplay =
        state.beforeBinding.style.get('display')?.value ?? ''
      changed.add(element)
    } else if (names.has('attr') && state.ownedAttributes.has(attributeName)) {
      updateAttributeBaselineFromReactProp(
        state,
        attributeName,
        reactProp,
        currentProps.get(reactProp)
      )
      changed.add(element)
    }
  }

  function visit(element: HTMLElement) {
    if (
      element !== root &&
      bindingRootRegistry(root).bindingRoots.has(element)
    ) return
    const state = bindingStates.get(element)
    if (state !== undefined) {
      const names = bindingNames(state.source)
      const currentProps = snapshotReactProps(element)

      if (
        (names.has('class') || names.has('css')) &&
        reactPropChanged(state.reactProps, currentProps, 'className')
      ) {
        const className = currentProps.get('className')
        if (className === undefined || className === null) {
          state.beforeBinding.attributes.delete('class')
        } else {
          state.beforeBinding.attributes.set('class', String(className))
        }
        changed.add(element)
      }

      const previousStyle = state.reactProps.get('style')
      const currentStyle = currentProps.get('style')
      const displayChanged = stylePropChanged(previousStyle, currentStyle, 'display')
      if (
        (names.has('style') ||
          ((names.has('visible') || names.has('hidden')) && displayChanged)) &&
        reactPropChanged(state.reactProps, currentProps, 'style')
      ) {
        updateStyleBaselineFromReactProps(state, previousStyle, currentStyle)
        if (displayChanged) {
          state.beforeBinding.styleDisplay =
            state.beforeBinding.style.get('display')?.value ?? ''
        }
        changed.add(element)
      }

      if (
        names.has('selectedOptions') &&
        element.ownerDocument.defaultView !== null &&
        element instanceof element.ownerDocument.defaultView.HTMLSelectElement &&
        reactPropChanged(state.reactProps, currentProps, 'value')
      ) {
        updateSelectedOptionsBaseline(element, currentProps.get('value'), bindingStates)
        changed.add(element)
      }

      const propertyBindings: Array<
        [string[], string[], 'value' | 'checked' | 'disabled']
      > = [
        [['value', 'defaultValue'], ['value', 'textInput', 'checkedValue'], 'value'],
        [['checked', 'defaultChecked'], ['checked'], 'checked'],
        [['disabled'], ['enable', 'disable'], 'disabled'],
      ]
      for (const [props, bindings, snapshotKey] of propertyBindings) {
        const changedProp = props.find((prop) =>
          reactPropChanged(state.reactProps, currentProps, prop)
        )
        if (
          bindings.some((binding) => names.has(binding)) &&
          changedProp !== undefined
        ) {
          const reactValue = currentProps.get(changedProp)
          if (snapshotKey === 'value') state.beforeBinding.value = reactValue ?? ''
          else if (snapshotKey === 'checked') state.beforeBinding.checked = Boolean(reactValue)
          else state.beforeBinding.disabled = Boolean(reactValue)
          changed.add(element)
        }
      }
    }

    for (const child of element.children) visit(child as HTMLElement)
  }
  visit(root)
  return changed
}

function refreshOwnedContent(
  records: MutationRecord[],
  changedElements: Set<HTMLElement>,
  bindingStates: BindingStateStore,
  reactCommitInProgress: boolean
) {
  const elements = new Set<HTMLElement>()
  for (const record of records) {
    if (record.type === 'childList' && record.target.nodeType === Node.ELEMENT_NODE) {
      elements.add(record.target as HTMLElement)
    } else if (
      record.type === 'characterData' &&
      record.target.parentNode?.nodeType === Node.ELEMENT_NODE
    ) {
      elements.add(record.target.parentNode as HTMLElement)
    }
  }

  for (const element of elements) {
    const state = bindingStates.get(element)
    if (state !== undefined && state.ownedContent !== null && !changedElements.has(element)) {
      // An element that was empty at bind time can gain React children later.
      // Direct text and HTML writes can instead replace a tracked node in place
      // or remove it with an empty payload, so compare their host props too.
      const owned = state.ownedContent
      const textChanged = records.some(
        (record) => record.type === 'characterData' && record.target.parentNode === element
      )
      const removedOwnedContent = records.some(
        (record) =>
          record.type === 'childList' &&
          record.target === element &&
          [...record.removedNodes].some((node) => owned.has(node))
      )
      // Direct text setters enter the synchronous path only when their write
      // matches an active React commit. An asynchronously delivered text
      // record can instead be a Knockout notification after that commit.
      const directReactContentTransition =
        (removedOwnedContent || (textChanged && reactCommitInProgress)) &&
        hasDirectReactContentTransition(
          element,
          state.reactProps,
          reactCommitInProgress
        )
      const hasUnownedChild = [...element.childNodes].some((child) => !owned.has(child))
      const contested =
        directReactContentTransition ||
        ((hasUnownedChild || textChanged) &&
          (hasReactOwnedChildren(element, owned) ||
            [...element.childNodes].some(
              (child) => !owned.has(child) && hasReactOwnership(child, element)
            )))
      if (contested) {
        if (state.customDescendantController !== null) {
          throw new Error(
            `react-ko cannot apply the Knockout "${state.customDescendantController}" binding because its custom handler controls React-owned child nodes. ` +
              'Custom bindings on elements with React-owned children must leave their descendants in place.'
          )
        }
        assertNoReactUnsafeBindings(
          element,
          directReactContentTransition,
          false
        )
      }

      // A single DOM operation can enqueue several records for one element.
      // Refresh only after all of them have been checked so the first record
      // cannot absorb a later React node into Knockout's ownership snapshot.
      state.ownedContent = new Set(element.childNodes)
    }
  }
}

function restoreAttribute(
  element: HTMLElement,
  snapshot: DomSnapshot,
  name: string
) {
  const value = snapshot.attributes.get(name)
  const separator = name.indexOf(':')
  const prefix = separator === -1 ? undefined : name.slice(0, separator)
  const namespace =
    prefix === undefined ? undefined : ATTRIBUTE_PREFIX_NAMESPACES.get(prefix)
  if (value === undefined) {
    if (namespace === undefined) element.removeAttribute(name)
    else element.removeAttributeNS(namespace, name.slice(separator + 1))
  } else {
    if (namespace === undefined) element.setAttribute(name, value)
    else element.setAttributeNS(namespace, name, value)
  }
}

function restoreStyle(element: HTMLElement, snapshot: DomSnapshot) {
  element.removeAttribute('style')
  for (const [name, { value, priority }] of snapshot.style) {
    element.style.setProperty(name, value, priority)
  }
}

function assertBindingsCanBeRetired(state: BindingState) {
  const names = bindingNames(state.source)
  const hasCanonicalHandlers = (name: string, visited = new Set<string>()): boolean => {
    if (visited.has(name)) return true
    const nextVisited = new Set(visited).add(name)

    const canonical =
      name === DESCENDANT_BINDING_BOUNDARY
        ? hasReactKoBindingHandler(name)
        : hasCanonicalKnockoutBindingHandler(name)
    return (
      canonical &&
      (DELEGATED_BINDING_HANDLERS.get(name)?.every((delegate) =>
        hasCanonicalHandlers(delegate, nextVisited)
      ) ?? true)
    )
  }
  const unsafe = [...rawBindingNames(state.source)].find((rawName) => {
    const name = rawName === 'textinput' ? 'textInput' : rawName
    return (
      !(
        SAFELY_RETIRABLE_BINDINGS.has(name) &&
        hasCanonicalHandlers(rawName)
      ) &&
      !(
        name.endsWith('Bubble') &&
        ko.bindingHandlers[rawName] === undefined &&
        (names.has('event') || (name === 'clickBubble' && names.has('click')))
      )
    )
  })
  if (unsafe !== undefined) {
    throw new Error(
      `react-ko cannot replace the Knockout "${unsafe}" binding because its DOM effects cannot be safely retired.`
    )
  }
}

function assertBindingTreeCanBeRetired(
  element: HTMLElement,
  root: HTMLElement,
  bindingStates: BindingStateStore
) {
  if (
    element !== root &&
    bindingRootRegistry(root).bindingRoots.has(element)
  ) {
    return
  }

  const state = bindingStates.get(element)
  if (state !== undefined) assertBindingsCanBeRetired(state)
  for (const child of element.children) {
    assertBindingTreeCanBeRetired(child as HTMLElement, root, bindingStates)
  }
}

/** Validates a complete root replacement before any of its bindings are disposed. */
export function assertBindingRootsCanBeRetired(roots: readonly HTMLElement[]) {
  const validatedRoots = new Set<HTMLElement>()
  for (const replacementRoot of roots) {
    const registry = bindingRootRegistry(replacementRoot)
    const affectedRoots = [...registry.bindingRoots.keys()].filter(
      (candidate) =>
        candidate === replacementRoot || replacementRoot.contains(candidate)
    )
    for (const root of affectedRoots) {
      if (validatedRoots.has(root)) continue
      validatedRoots.add(root)
      const state = registry.bindingObservers.get(root)
      if (state !== undefined) {
        assertBindingTreeCanBeRetired(root, root, state.bindingStates)
      }
    }
  }
}

function restoreRetiredDomEffects(element: HTMLElement, state: BindingState) {
  assertBindingsCanBeRetired(state)
  const names = bindingNames(state.source)
  const properties = element as HTMLElement & {
    value?: unknown
    checked?: boolean
    disabled?: boolean
    selected?: boolean
  }

  if (names.has('class') || names.has('css')) {
    restoreAttribute(element, state.beforeBinding, 'class')
  }
  if (names.has('style')) {
    restoreStyle(element, state.beforeBinding)
  } else if (names.has('visible') || names.has('hidden')) {
    element.style.display = state.beforeBinding.styleDisplay
  }
  if (names.has('attr')) {
    for (const name of state.ownedAttributes) {
      if (name === 'class' && (names.has('class') || names.has('css'))) continue
      if (name === 'style' && names.has('style')) continue
      restoreAttribute(element, state.beforeBinding, name)
    }
  }
  // Knockout's checked binding delegates to uniqueName for unnamed radios so
  // that old IE does not merge unrelated radio groups. Retiring checked must
  // undo that implicit attribute just as retiring uniqueName does.
  if (names.has('uniqueName') || names.has('checked')) {
    restoreAttribute(element, state.beforeBinding, 'name')
  }
  if (
    (names.has('value') || names.has('textInput') || names.has('checkedValue')) &&
    'value' in state.beforeBinding
  ) {
    properties.value = state.beforeBinding.value
  }
  if (names.has('checked') && state.beforeBinding.checked !== undefined) {
    properties.checked = state.beforeBinding.checked
  }
  if (
    (names.has('enable') || names.has('disable')) &&
    state.beforeBinding.disabled !== undefined
  ) {
    properties.disabled = state.beforeBinding.disabled
  }
  if (names.has('selectedOptions') && state.beforeBinding.selected !== undefined) {
    properties.selected = state.beforeBinding.selected
  }
  if (names.has('hasFocus') || names.has('hasfocus')) {
    if (state.beforeBinding.focused) {
      element.focus()
    } else if (element.ownerDocument.activeElement === element) {
      element.blur()
    }
  }
}

function restoreBindingTree(
  element: HTMLElement,
  root: HTMLElement,
  bindingStates: BindingStateStore
) {
  if (
    element !== root &&
    bindingRootRegistry(root).bindingRoots.has(element)
  ) {
    return
  }

  const state = bindingStates.get(element)
  if (state !== undefined) {
    restoreRetiredDomEffects(element, state)
    if (bindingNames(state.source).has('selectedOptions')) {
      for (const option of element.querySelectorAll('option')) {
        const selected = bindingStates.get(option)?.beforeBinding.selected
        if (selected !== undefined) {
          option.selected = selected
        }
      }
    }
    if (
      element !== root &&
      bindingNames(state.source).has(DESCENDANT_BINDING_BOUNDARY)
    ) {
      return
    }
  }

  for (const child of element.children) {
    restoreBindingTree(child as HTMLElement, root, bindingStates)
  }
}

function removeRetiredContent(
  element: HTMLElement,
  state: BindingState | undefined,
  addedRoots: HTMLElement[]
) {
  if (
    state === undefined ||
    !controlsElementContent(state.source) ||
    state.ownedContent === null
  ) {
    return
  }

  const hasNewReactChildren = addedRoots.some((addedRoot) => element.contains(addedRoot))
  const retiredNodes = hasReactOwnedChildren(element) || hasNewReactChildren
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
  bindingStates: BindingStateStore,
  addedRoots: HTMLElement[]
) {
  for (const element of changedElements) {
    const previousState = bindingStates.get(element)
    const bindingContext =
      ko.contextFor(element) ?? descendantBindingContextFor(element, root) ?? viewModel
    ko.cleanNode(element)
    removeRetiredContent(element, previousState, addedRoots)
    restoreBindingTree(element, root, bindingStates)
    prepareBindingTree(element, root, bindingStates)
    applyBindingsSafely(
      bindingContext,
      element,
      registeredDescendantRoots(element)
    )
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
        if (node.nodeType === Node.ELEMENT_NODE) {
          releaseReactTrackedChecked(node as HTMLElement)
        }
      }
    }
  }
}

function bindAddedNodes(
  records: MutationRecord[],
  root: HTMLElement,
  viewModel: unknown,
  bindingStates: BindingStateStore
) {
  for (const record of records) {
    if (
      record.type === 'characterData' &&
      record.target.parentNode?.nodeType === Node.ELEMENT_NODE &&
      belongsToBindingRoot(record.target, root) &&
      hasReactOwnership(record.target, record.target.parentNode as Element)
    ) {
      assertNoReactUnsafeBindings(
        record.target.parentNode as HTMLElement,
        false,
        false
      )
    }

    for (const node of record.addedNodes) {
      if (
        (node.nodeType !== Node.ELEMENT_NODE && node.nodeType !== Node.TEXT_NODE) ||
        !belongsToBindingRoot(node, root) ||
        (node.nodeType === Node.ELEMENT_NODE && ko.contextFor(node) !== undefined) ||
        isKnockoutOwnedContentAddition(record, node, bindingStates)
      ) {
        continue
      }

      // Binding the highest added element covers its subtree and respects any
      // descendant scope boundary encountered during that pass.
      if (record.target.nodeType === Node.ELEMENT_NODE) {
        assertNoReactUnsafeBindings(record.target as HTMLElement, false, false)
      }
      if (node.nodeType === Node.TEXT_NODE) {
        continue
      }
      const bindingContext = descendantBindingContextFor(node, root)
      prepareBindingTree(node as HTMLElement, root, bindingStates)
      applyBindingsSafely(
        bindingContext ?? viewModel,
        node as HTMLElement,
        registeredDescendantRoots(node as HTMLElement)
      )
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
  onError: (error: unknown) => void,
  bindingStates: BindingStateStore = prepareBindingDescendants(root),
  shouldDeferReconciliation?: () => boolean,
  deferredSuspenseBindings: readonly DeferredSuspenseBinding[] = []
) {
  const registry = bindingRootRegistry(root)
  registry.bindingRoots.set(root, viewModel)
  const deferredSuspenseElements = new Set(
    deferredSuspenseBindings.flatMap(({ start, end }) =>
      suspenseRangeElements(start, end)
    )
  )
  trackBindingTree(root, root, bindingStates, deferredSuspenseElements)

  const deferredRecords: MutationRecord[] = []

  const reconcile = (records: MutationRecord[], reactCommitInProgress = false) => {
    cleanRemovedNodes(records, root)
    const addedRoots = addedBindingRoots(records, root, bindingStates)
    const changedElements = changedBindingElements(records, root, addedRoots)
    for (const select of changedOptionSelects(
      records,
      root,
      bindingStates
    )) {
      changedElements.add(select)
    }
    recordOwnedAttributeChanges(records, bindingStates)
    for (const element of refreshReactOwnedDom(
      records,
      root,
      bindingStates
    )) {
      changedElements.add(element)
    }
    refreshOwnedContent(
      records,
      changedElements,
      bindingStates,
      reactCommitInProgress
    )
    rebindChangedAttributes(changedElements, root, viewModel, bindingStates, addedRoots)
    bindAddedNodes(records, root, viewModel, bindingStates)
    // Rebinding deliberately mutates the same attributes that React changed.
    // They are already reflected in the refreshed state and must not start a
    // second ownership transition in the observer microtask.
    observer.takeRecords()
  }
  const observer = new MutationObserver((records) => {
    if (registry.reconcilingRoots.has(root)) {
      return
    }

    registry.reconcilingRoots.add(root)
    try {
      if (shouldDeferReconciliation?.() === true) {
        // The replacement pass cleans and binds the current tree as a whole.
        // Only detached nodes need immediate cleanup from this delivered batch.
        cleanRemovedNodes(records, root)
        // The pass this batch is waiting for is not certain to arrive: a replacement
        // rendered but never committed leaves the root bound as it was. Keeping the
        // batch means the next reconciliation still sees these nodes, rather than the
        // announcement quietly costing them their bindings.
        deferredRecords.push(...records)
        return
      }
      reconcile([...deferredRecords.splice(0), ...records])
    } catch (error) {
      observer.disconnect()
      onError(error)
    } finally {
      registry.reconcilingRoots.delete(root)
      scheduleHydrationCheck(records.length > 0)
    }
  })
  registry.bindingObservers.set(root, {
    observer,
    bindingStates,
    reconcile,
    shouldDeferReconciliation,
    onError,
    // React sets data-bind before clearing the host's previous text or HTML.
    // Let that host mutation finish so stale current props do not make the
    // newly empty element appear contested during its binding handoff.
    shouldDeferDataBindChange: (target) => {
      const element = target as HTMLElement
      const state = bindingStates.get(element)
      const source = element.getAttribute('data-bind')
      const nextProps = reactHostFiber(element)?.alternate?.pendingProps
      return (
        state?.source === null &&
        source !== null &&
        controlsElementContent(source) &&
        nextProps?.['data-bind'] === source &&
        directReactContent(nextProps) === null &&
        hasReactOwnedChildren(element)
      )
    },
    // A content binding may be inserting its own DOM, or React may be retiring
    // that binding in the same commit. Inspect React's work-in-progress host
    // props so only the latter ownership transition is deferred. If the binding
    // remains, reconcile synchronously before a child layout effect can update
    // Knockout and let it detach that child.
    shouldDeferInsertion: (parent) => {
      if (parent.nodeType !== Node.ELEMENT_NODE) {
        return false
      }

      const element = parent as HTMLElement
      const state = bindingStates.get(element)
      if (state === undefined || state.ownedContent === null) {
        return false
      }

      return currentReactHostProps(element, true)?.['data-bind'] !== state.source
    },
    shouldReconcileDirectTextWrite: (element, kind, value) => {
      const state = bindingStates.get(element)
      return (
        state !== undefined &&
        state.ownedContent !== null &&
        hasActiveDirectReactContentWrite(element, state.reactProps, kind, value)
      )
    },
    refreshAfterLayout: () => {
      const records = observer.takeRecords()
      reconcile(records, true)
      const layoutTargets = new Set(
        records.flatMap((record) => {
          if (record.target.nodeType === Node.ELEMENT_NODE) {
            return [record.target as HTMLElement]
          }
          return record.target.parentElement === null
            ? []
            : [record.target.parentElement]
        })
      )
      const changedElements = new Set<HTMLElement>()
      function visit(element: HTMLElement) {
        if (
          element !== root &&
          bindingRootRegistry(root).bindingRoots.has(element)
        ) return
        const state = bindingStates.get(element)
        const names = bindingNames(state?.source ?? null)
        if (
          layoutTargets.has(element) &&
          names.size > 0 &&
          [...names].every((name) => POST_LAYOUT_REFRESH_BINDINGS.has(name))
        ) {
          try {
            if (state !== undefined) assertBindingsCanBeRetired(state)
            changedElements.add(element)
          } catch {
            // A consumer override cannot be safely initialized a second time.
          }
        }
        for (const child of element.children) visit(child as HTMLElement)
      }
      visit(root)
      rebindChangedAttributes(
        changedElements,
        root,
        viewModel,
        bindingStates,
        []
      )
      observer.takeRecords()
    },
  })
  observer.observe(root, {
    attributes: true,
    characterData: true,
    childList: true,
    subtree: true,
  })
  const stopIntercepting = interceptDataBindChanges(root)
  const stopInterceptingInsertions = interceptChildListInsertions(root)
  const stopInterceptingDirectText = interceptDirectTextWrites(root)
  const pendingSuspenseBindings = new Map(
    deferredSuspenseBindings.map((binding) => [binding.start, binding])
  )
  const initialHydrationDelay = 16
  const maximumHydrationDelay = 1000
  let hydrationDelay = initialHydrationDelay
  let hydrationTimer: number | null = null
  let hydrationDeadline: number | null = null
  let stopped = false

  const scheduleHydrationCheck = (domChanged = false) => {
    const view = root.ownerDocument.defaultView
    if (stopped || view === null || pendingSuspenseBindings.size === 0) {
      return
    }

    if (domChanged) {
      hydrationDelay = initialHydrationDelay
    }

    const scheduledDelay = hydrationDelay
    const scheduledDeadline = Date.now() + scheduledDelay
    if (
      hydrationTimer !== null &&
      hydrationDeadline !== null &&
      hydrationDeadline <= scheduledDeadline
    ) {
      return
    }
    if (hydrationTimer !== null) view.clearTimeout(hydrationTimer)

    hydrationDeadline = scheduledDeadline
    hydrationTimer = view.setTimeout(() => {
      hydrationTimer = null
      hydrationDeadline = null
      hydrationDelay = Math.min(scheduledDelay * 2, maximumHydrationDelay)
      checkHydratedSuspenseBindings()
    }, scheduledDelay)
  }

  const queueDeferredBindings = (
    bindings: readonly DeferredSuspenseBinding[]
  ) => {
    let added = false
    for (const binding of bindings) {
      added ||= !pendingSuspenseBindings.has(binding.start)
      pendingSuspenseBindings.set(binding.start, binding)
    }
    if (added) hydrationDelay = initialHydrationDelay
    scheduleHydrationCheck()
  }

  const checkHydratedSuspenseBindings = () => {
    if (stopped) return

    registry.reconcilingRoots.add(root)
    try {
      for (const [start, binding] of pendingSuspenseBindings) {
        if (!root.contains(start) || !root.contains(binding.end)) {
          pendingSuspenseBindings.delete(start)
          continue
        }

        const elements = suspenseRangeElements(start, binding.end)
        if (!elements.some((element) => hasReactOwnership(element))) continue

        pendingSuspenseBindings.delete(start)
        const topLevelElements = elements.filter(
          (element) =>
            !elements.some(
              (candidate) => candidate !== element && candidate.contains(element)
            ) && hasReactOwnership(element)
        ) as HTMLElement[]
        for (const element of topLevelElements) {
          const bindingContext =
            descendantBindingContextFor(element, root) ?? viewModel
          prepareBindingTree(element, root, bindingStates)
          for (const descendant of [element, ...element.querySelectorAll('*')]) {
            deferredSuspenseElements.delete(descendant)
          }
          const nestedBindings = applyBindingsSafely(
            bindingContext,
            element,
            registeredDescendantRoots(element)
          )
          for (const nested of nestedBindings) {
            for (const descendant of suspenseRangeElements(
              nested.start,
              nested.end
            )) {
              deferredSuspenseElements.add(descendant)
            }
          }
          queueDeferredBindings(nestedBindings)
          trackBindingTree(
            element,
            root,
            bindingStates,
            deferredSuspenseElements
          )
        }
      }
      observer.takeRecords()
    } catch (error) {
      observer.disconnect()
      pendingSuspenseBindings.clear()
      onError(error)
    } finally {
      registry.reconcilingRoots.delete(root)
    }

    // Hydrating an outer boundary can reveal a still-dehydrated nested one.
    queueDeferredBindings(findDehydratedSuspenseBindings(root))
    scheduleHydrationCheck()
  }

  queueDeferredBindings(findDehydratedSuspenseBindings(root))

  return () => {
    // A removal and root unmount can happen before the observer callback. Drain
    // pending removals before disconnecting so subscriptions are not orphaned.
    const pendingRecords = observer.takeRecords()
    stopped = true
    if (hydrationTimer !== null) {
      root.ownerDocument.defaultView?.clearTimeout(hydrationTimer)
    }
    observer.disconnect()
    registry.bindingRoots.delete(root)
    registry.bindingObservers.delete(root)
    registry.reconcilingRoots.delete(root)
    registry.scheduledPropertyRoots.delete(root)
    stopIntercepting()
    stopInterceptingInsertions()
    stopInterceptingDirectText()
    cleanRemovedNodes(pendingRecords, root)
    releaseReactTrackedChecked(root, root)
  }
}

/** Makes every root in one React scope visible before any of them binds. */
export function registerBindingRoot(root: HTMLElement, viewModel: unknown) {
  bindingRootRegistry(root).bindingRoots.set(root, viewModel)
}

/** Removes a root whose binding pass failed before observation began. */
export function unregisterBindingRoot(root: HTMLElement) {
  bindingRootRegistry(root).bindingRoots.delete(root)
}

/** Reconciles queued React DOM mutations before descendant layout effects run. */
export function reconcileBindingDescendants(root: HTMLElement) {
  const registry = bindingRootRegistry(root)
  const state = registry.bindingObservers.get(root)
  if (
    state === undefined ||
    state.shouldDeferReconciliation?.() === true ||
    registry.reconcilingRoots.has(root)
  ) {
    return
  }

  const records = state.observer.takeRecords()
  registry.reconcilingRoots.add(root)
  try {
    state.reconcile(records, true)
  } catch (error) {
    state.observer.disconnect()
    // React continues mounting layout effects after a host mutation throws.
    // Retire Knockout now so an effect cannot update a content binding and
    // detach the child whose insertion just failed validation.
    ko.cleanNode(root)
    throw error
  } finally {
    registry.reconcilingRoots.delete(root)
  }
}

/** Reapplies safely repeatable bindings after enclosing layout effects. */
export function refreshBindingDescendantsAfterLayout(root: HTMLElement) {
  const registry = bindingRootRegistry(root)
  const state = registry.bindingObservers.get(root)
  if (state === undefined || registry.reconcilingRoots.has(root)) return

  registry.reconcilingRoots.add(root)
  try {
    state.refreshAfterLayout()
  } catch (error) {
    state.observer.disconnect()
    state.onError(error)
  } finally {
    registry.reconcilingRoots.delete(root)
  }
}
