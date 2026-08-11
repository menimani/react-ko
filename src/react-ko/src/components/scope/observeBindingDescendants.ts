import ko from 'knockout'
import {
  applyBindingsSafely,
  assertNoReactUnsafeBindings,
  currentReactHostProps,
  hasReactOwnedChildren,
} from './applyBindingsSafely'
import { descendantBindingContextFor } from './descendantBindingContexts'
import { DESCENDANT_BINDING_BOUNDARY } from './descendantBindingBoundary'

// Observers on enclosing roots also see mutations inside nested scopes. Keep
// track of each binding root so only the nearest one handles a changed subtree.
// The view model registry also lets an ancestor attribute rebind restore any
// descendant roots that ko.cleanNode necessarily cleaned along with it.
const bindingRoots = new Map<HTMLElement, unknown>()
const bindingObservers = new Map<
  HTMLElement,
  {
    observer: MutationObserver
    reconcile: (records: MutationRecord[], reactCommitInProgress?: boolean) => void
    shouldDeferDataBindChange: (element: Element) => boolean
    shouldDeferInsertion: (parent: Node) => boolean
    onError: (error: unknown) => void
  }
>()
const reconcilingRoots = new Set<HTMLElement>()
type AttributeInterceptor = {
  count: number
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
const attributeInterceptors = new Map<typeof Element.prototype, AttributeInterceptor>()
const scheduledPropertyRoots = new Set<HTMLElement>()
type TrackedCheckedInterceptor = {
  descriptor: PropertyDescriptor
  interceptedSet: (value: unknown) => void
}
const trackedCheckedInterceptors = new WeakMap<
  HTMLInputElement,
  TrackedCheckedInterceptor
>()
type ChildListInterceptor = {
  count: number
  appendChild: typeof Node.prototype.appendChild
  insertBefore: typeof Node.prototype.insertBefore
  replaceChild: typeof Node.prototype.replaceChild
  interceptedAppendChild: typeof Node.prototype.appendChild
  interceptedInsertBefore: typeof Node.prototype.insertBefore
  interceptedReplaceChild: typeof Node.prototype.replaceChild
}
const childListInterceptors = new Map<typeof Node.prototype, ChildListInterceptor>()
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
  ownedContent: Set<Node> | null
  ownedAttributes: Set<string>
  beforeBinding: DomSnapshot
  reactProps: Map<string, unknown>
}

type BindingStateStore = WeakMap<HTMLElement, BindingState>

function bindingNames(source: string | null) {
  if (source === null) {
    return new Set<string>()
  }

  return new Set(
    ko.expressionRewriting
      .parseObjectLiteral(source)
      .flatMap(({ key }) =>
        key === undefined ? [] : [key === 'textinput' ? 'textInput' : key]
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
  const get = (name: string) => (props instanceof Map ? props.get(name) : props?.[name])
  const innerHtml = (get('dangerouslySetInnerHTML') as { __html?: unknown } | undefined)
    ?.__html
  if (innerHtml !== undefined && innerHtml !== null) {
    return { kind: 'html', value: String(innerHtml) } as const
  }

  const children = get('children')
  if (
    typeof children === 'string' ||
    typeof children === 'number' ||
    typeof children === 'bigint'
  ) {
    return { kind: 'text', value: String(children) } as const
  }

  return null
}

function hasDirectReactContentTransition(
  element: HTMLElement,
  previousProps: ReadonlyMap<string, unknown>,
  reactCommitInProgress: boolean
) {
  const previous = directReactContent(previousProps)
  const current = directReactContent(
    currentReactHostProps(element, reactCommitInProgress)
  )

  return (
    (previous !== null || current !== null) &&
    (previous === null ||
      current === null ||
      current.kind !== previous.kind ||
      current.value !== previous.value)
  )
}

function prepareBindingTree(
  element: HTMLElement,
  root: HTMLElement,
  bindingStates: BindingStateStore
) {
  if (element !== root && bindingRoots.has(element)) {
    return
  }

  bindingStates.set(element, {
    source: element.getAttribute('data-bind'),
    ownedContent: null,
    ownedAttributes: new Set(),
    beforeBinding: snapshotDom(element),
    reactProps: snapshotReactProps(element),
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

  let ancestor = node.parentNode
  while (ancestor !== null && ancestor !== root) {
    if (bindingRoots.has(ancestor as HTMLElement)) {
      return false
    }
    ancestor = ancestor.parentNode
  }

  return ancestor === root
}

function nearestBindingRoot(element: Element) {
  let nearest: HTMLElement | undefined

  for (const root of bindingObservers.keys()) {
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
    if (bindingObservers.get(root)?.shouldDeferDataBindChange(element)) {
      return
    }
    reconcileBindingDescendants(root)
  }
}

function hasReactOwnership(node: Node, parent?: Element) {
  // React 18 and 19 tag host nodes before inserting them. Knockout-created
  // template nodes have no such tag and must remain on the asynchronous path.
  // Direct text has no tag, so its host's committed or pending props decide.
  if (node.nodeType === Node.TEXT_NODE && parent !== undefined) {
    return hasReactOwnedChildren(parent)
  }

  if (
    node.nodeType === Node.ELEMENT_NODE &&
    Object.getOwnPropertyNames(node).some(
      (name) => name.startsWith('__reactFiber$') || name.startsWith('__reactProps$')
    )
  ) {
    return true
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
  const state = root === undefined ? undefined : bindingObservers.get(root)
  if (
    root !== undefined &&
    state !== undefined &&
    !state.shouldDeferInsertion(parent) &&
    !reconcilingRoots.has(root)
  ) {
    reconcileBindingDescendants(root)
  }
}

function releaseAttributeInterceptor(prototype: typeof Element.prototype) {
  const interceptor = attributeInterceptors.get(prototype)
  if (interceptor === undefined) {
    return
  }

  interceptor.count -= 1
  if (interceptor.count !== 0) {
    return
  }

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
  attributeInterceptors.delete(prototype)
}

function reconcileChangedProperty(element: Element) {
  const root = nearestBindingRoot(element)
  if (root === undefined || scheduledPropertyRoots.has(root)) return
  scheduledPropertyRoots.add(root)
  queueMicrotask(() => {
    scheduledPropertyRoots.delete(root)
    const state = bindingObservers.get(root)
    if (state === undefined || reconcilingRoots.has(root)) return
    reconcilingRoots.add(root)
    try {
      state.reconcile([])
    } catch (error) {
      state.observer.disconnect()
      state.onError(error)
    } finally {
      reconcilingRoots.delete(root)
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
    bindingRoots.has(element)
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

function interceptFormProperties(view: Window & typeof globalThis) {
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
      reconcileChangedProperty(this)
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

  const prototype = view.Element.prototype
  const existing = attributeInterceptors.get(prototype)
  if (existing !== undefined) {
    existing.count += 1
    return () => releaseAttributeInterceptor(prototype)
  }

  const setAttribute = prototype.setAttribute
  const removeAttribute = prototype.removeAttribute
  // MutationObserver callbacks run after layout effects, and a state update
  // below the binding root does not rerender that root. Drain the queued
  // data-bind record directly from React's attribute mutation in that case.
  const interceptedSetAttribute: typeof prototype.setAttribute = function (name, value) {
    setAttribute.call(this, name, value)
    reconcileChangedDataBind(this, name)
  }
  const interceptedRemoveAttribute: typeof prototype.removeAttribute = function (name) {
    removeAttribute.call(this, name)
    reconcileChangedDataBind(this, name)
  }
  prototype.setAttribute = interceptedSetAttribute
  prototype.removeAttribute = interceptedRemoveAttribute
  const formProperties = interceptFormProperties(view)
  attributeInterceptors.set(prototype, {
    count: 1,
    setAttribute,
    removeAttribute,
    interceptedSetAttribute,
    interceptedRemoveAttribute,
    formProperties,
  })

  return () => releaseAttributeInterceptor(prototype)
}

function releaseChildListInterceptor(prototype: typeof Node.prototype) {
  const interceptor = childListInterceptors.get(prototype)
  if (interceptor === undefined) {
    return
  }

  interceptor.count -= 1
  if (interceptor.count !== 0) {
    return
  }

  if (prototype.appendChild === interceptor.interceptedAppendChild) {
    prototype.appendChild = interceptor.appendChild
  }
  if (prototype.insertBefore === interceptor.interceptedInsertBefore) {
    prototype.insertBefore = interceptor.insertBefore
  }
  if (prototype.replaceChild === interceptor.interceptedReplaceChild) {
    prototype.replaceChild = interceptor.replaceChild
  }
  childListInterceptors.delete(prototype)
}

function interceptChildListInsertions(root: HTMLElement) {
  const view = root.ownerDocument.defaultView
  if (view === null) {
    return () => undefined
  }

  const prototype = view.Node.prototype
  const existing = childListInterceptors.get(prototype)
  if (existing !== undefined) {
    existing.count += 1
    return () => releaseChildListInterceptor(prototype)
  }

  const appendChild = prototype.appendChild
  const insertBefore = prototype.insertBefore
  const replaceChild = prototype.replaceChild
  const interceptedAppendChild: typeof prototype.appendChild = function <T extends Node>(
    child: T
  ): T {
    const reactOwned = hasReactOwnership(
      child,
      this.nodeType === Node.ELEMENT_NODE ? (this as Element) : undefined
    )
    const inserted = appendChild.call(this, child) as T
    reconcileInsertedChildren(this, reactOwned)
    return inserted
  }
  const interceptedInsertBefore: typeof prototype.insertBefore = function <T extends Node>(
    child: T,
    referenceChild: Node | null
  ): T {
    const reactOwned = hasReactOwnership(
      child,
      this.nodeType === Node.ELEMENT_NODE ? (this as Element) : undefined
    )
    const inserted = insertBefore.call(this, child, referenceChild) as T
    reconcileInsertedChildren(this, reactOwned)
    return inserted
  }
  const interceptedReplaceChild: typeof prototype.replaceChild = function <T extends Node>(
    child: Node,
    replacedChild: T
  ): T {
    const reactOwned = hasReactOwnership(
      child,
      this.nodeType === Node.ELEMENT_NODE ? (this as Element) : undefined
    )
    const replaced = replaceChild.call(this, child, replacedChild) as T
    reconcileInsertedChildren(this, reactOwned)
    return replaced
  }
  prototype.appendChild = interceptedAppendChild
  prototype.insertBefore = interceptedInsertBefore
  prototype.replaceChild = interceptedReplaceChild
  childListInterceptors.set(prototype, {
    count: 1,
    appendChild,
    insertBefore,
    replaceChild,
    interceptedAppendChild,
    interceptedInsertBefore,
    interceptedReplaceChild,
  })

  return () => releaseChildListInterceptor(prototype)
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

export function restoreDescendantBindingRoots(element: HTMLElement, ownerRoot: HTMLElement) {
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

function trackBindingTree(
  element: HTMLElement,
  ownerRoot: HTMLElement,
  bindingStates: BindingStateStore
) {
  if (element !== ownerRoot && bindingRoots.has(element)) {
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
  bindingStates.set(element, {
    source,
    ownedContent: controlsElementContent(source) ? new Set(element.childNodes) : null,
    ownedAttributes,
    beforeBinding,
    reactProps: snapshotReactProps(element),
  })

  for (const child of element.children) {
    trackBindingTree(child as HTMLElement, ownerRoot, bindingStates)
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

  for (const record of records) {
    if (record.type !== 'childList' || record.target.nodeType !== Node.ELEMENT_NODE) {
      continue
    }

    const parent = record.target as Element
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
  const baseline = reactAttributeValue(propName, value)
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
    (name) =>
      (REACT_PROP_ATTRIBUTE_ALIASES.get(name) ?? name).toLowerCase() ===
      attributeName.toLowerCase()
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
    if (element !== root && bindingRoots.has(element)) return
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
        [string, string[], 'value' | 'checked' | 'disabled']
      > = [
        ['value', ['value', 'textInput', 'checkedValue'], 'value'],
        ['checked', ['checked'], 'checked'],
        ['disabled', ['enable', 'disable'], 'disabled'],
      ]
      for (const [prop, bindings, snapshotKey] of propertyBindings) {
        if (
          bindings.some((binding) => names.has(binding)) &&
          reactPropChanged(state.reactProps, currentProps, prop)
        ) {
          const reactValue = currentProps.get(prop)
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
      const directReactContentTransition =
        (removedOwnedContent || textChanged) &&
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
        assertNoReactUnsafeBindings(element, directReactContentTransition)
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
  const unsafe = [...bindingNames(state.source)].find(
    (name) => !SAFELY_RETIRABLE_BINDINGS.has(name)
  )
  if (unsafe !== undefined) {
    throw new Error(
      `react-ko cannot replace the Knockout "${unsafe}" binding because its DOM effects cannot be safely retired.`
    )
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
  if (names.has('uniqueName')) {
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
  if (element !== root && bindingRoots.has(element)) {
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
    applyBindingsSafely(bindingContext, element)
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
      assertNoReactUnsafeBindings(record.target.parentNode as HTMLElement)
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
        assertNoReactUnsafeBindings(record.target as HTMLElement)
      }
      if (node.nodeType === Node.TEXT_NODE) {
        continue
      }
      const bindingContext = descendantBindingContextFor(node, root)
      prepareBindingTree(node as HTMLElement, root, bindingStates)
      applyBindingsSafely(bindingContext ?? viewModel, node as HTMLElement)
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
  bindingStates: BindingStateStore = prepareBindingDescendants(root)
) {
  bindingRoots.set(root, viewModel)
  trackBindingTree(root, root, bindingStates)

  const reconcile = (records: MutationRecord[], reactCommitInProgress = false) => {
    cleanRemovedNodes(records, root)
    const addedRoots = addedBindingRoots(records, root, bindingStates)
    const changedElements = changedBindingElements(records, root, addedRoots)
    for (const select of changedOptionSelects(records, root, bindingStates)) {
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
    if (reconcilingRoots.has(root)) {
      return
    }

    reconcilingRoots.add(root)
    try {
      reconcile(records)
    } catch (error) {
      observer.disconnect()
      onError(error)
    } finally {
      reconcilingRoots.delete(root)
    }
  })
  bindingObservers.set(root, {
    observer,
    reconcile,
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

      const reactFiberKey = Object.getOwnPropertyNames(element).find((name) =>
        name.startsWith('__reactFiber$')
      )
      if (reactFiberKey === undefined) {
        return false
      }
      const fiber = (element as unknown as Record<string, unknown>)[reactFiberKey] as {
        alternate?: { pendingProps: Record<string, unknown> } | null
      }

      // During the mutation phase the DOM marker still points at the current
      // fiber, while its alternate contains the props being committed.
      return fiber.alternate !== undefined &&
        fiber.alternate !== null &&
        fiber.alternate.pendingProps['data-bind'] !== state.source
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

  return () => {
    // A removal and root unmount can happen before the observer callback. Drain
    // pending removals before disconnecting so subscriptions are not orphaned.
    const pendingRecords = observer.takeRecords()
    observer.disconnect()
    bindingRoots.delete(root)
    bindingObservers.delete(root)
    stopIntercepting()
    stopInterceptingInsertions()
    cleanRemovedNodes(pendingRecords, root)
    releaseReactTrackedChecked(root, root)
  }
}

/** Reconciles queued React DOM mutations before descendant layout effects run. */
export function reconcileBindingDescendants(root: HTMLElement) {
  const state = bindingObservers.get(root)
  if (state === undefined || reconcilingRoots.has(root)) {
    return
  }

  const records = state.observer.takeRecords()
  reconcilingRoots.add(root)
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
    reconcilingRoots.delete(root)
  }
}
