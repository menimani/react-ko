import ko from 'knockout'
import {
  applyBindingsSafely,
  assertNoReactUnsafeBindings,
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
    reconcile: (records: MutationRecord[]) => void
    shouldDeferInsertion: (parent: Node) => boolean
  }
>()
const reconcilingRoots = new Set<HTMLElement>()
type AttributeInterceptor = {
  count: number
  setAttribute: typeof Element.prototype.setAttribute
  removeAttribute: typeof Element.prototype.removeAttribute
  interceptedSetAttribute: typeof Element.prototype.setAttribute
  interceptedRemoveAttribute: typeof Element.prototype.removeAttribute
}
const attributeInterceptors = new Map<typeof Element.prototype, AttributeInterceptor>()
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
  'click',
  'component',
  'css',
  'disable',
  'enable',
  'event',
  'hasFocus',
  'hasfocus',
  'html',
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
}

export type BindingStateStore = WeakMap<HTMLElement, BindingState>

function bindingNames(source: string | null) {
  if (source === null) {
    return new Set<string>()
  }

  return new Set(
    ko.expressionRewriting
      .parseObjectLiteral(source)
      .flatMap(({ key }) => (key === undefined ? [] : [key]))
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
    styleDisplay: element.style.display,
    focused: element.ownerDocument.activeElement === element,
    ...('value' in properties ? { value: properties.value } : {}),
    ...('checked' in properties ? { checked: properties.checked } : {}),
    ...('disabled' in properties ? { disabled: properties.disabled } : {}),
    ...('selected' in properties ? { selected: properties.selected } : {}),
  }
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
    reconcileBindingDescendants(root)
  }
}

function hasReactOwnership(node: Node) {
  // React 18 and 19 tag host nodes before inserting them. Knockout-created
  // template nodes have no such tag and must remain on the asynchronous path.
  if (
    node.nodeType === Node.ELEMENT_NODE &&
    Object.getOwnPropertyNames(node).some(
      (name) => name.startsWith('__reactFiber$') || name.startsWith('__reactProps$')
    )
  ) {
    return true
  }

  return [...node.childNodes].some(hasReactOwnership)
}

function reconcileInsertedChildren(parent: Node, reactOwned: boolean) {
  if (!reactOwned || parent.nodeType !== Node.ELEMENT_NODE) {
    return
  }

  const root = nearestBindingRoot(parent as Element)
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
  attributeInterceptors.delete(prototype)
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
  attributeInterceptors.set(prototype, {
    count: 1,
    setAttribute,
    removeAttribute,
    interceptedSetAttribute,
    interceptedRemoveAttribute,
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
    const reactOwned = hasReactOwnership(child)
    const inserted = appendChild.call(this, child) as T
    reconcileInsertedChildren(this, reactOwned)
    return inserted
  }
  const interceptedInsertBefore: typeof prototype.insertBefore = function <T extends Node>(
    child: T,
    referenceChild: Node | null
  ): T {
    const reactOwned = hasReactOwnership(child)
    const inserted = insertBefore.call(this, child, referenceChild) as T
    reconcileInsertedChildren(this, reactOwned)
    return inserted
  }
  const interceptedReplaceChild: typeof prototype.replaceChild = function <T extends Node>(
    child: Node,
    replacedChild: T
  ): T {
    const reactOwned = hasReactOwnership(child)
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

function addedBindingRoots(records: MutationRecord[], root: Node) {
  const addedRoots: HTMLElement[] = []

  for (const record of records) {
    for (const node of record.addedNodes) {
      if (
        node.nodeType === Node.ELEMENT_NODE &&
        belongsToBindingRoot(node, root) &&
        ko.contextFor(node) === undefined
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

function recordOwnedAttributeChanges(
  records: MutationRecord[],
  bindingStates: BindingStateStore
) {
  for (const record of records) {
    if (
      record.type !== 'attributes' ||
      record.attributeName === null ||
      record.attributeName === 'data-bind'
    ) {
      continue
    }

    const element = record.target as HTMLElement
    const state = bindingStates.get(element)
    if (state !== undefined && bindingNames(state.source).has('attr')) {
      state.ownedAttributes.add(record.attributeName)
    }
  }
}

function refreshOwnedContent(
  records: MutationRecord[],
  changedElements: Set<HTMLElement>,
  bindingStates: BindingStateStore
) {
  for (const record of records) {
    if (record.type !== 'childList' || record.target.nodeType !== Node.ELEMENT_NODE) {
      continue
    }

    const element = record.target as HTMLElement
    const state = bindingStates.get(element)
    if (state !== undefined && state.ownedContent !== null && !changedElements.has(element)) {
      // An element that was empty at bind time can gain React children later.
      // Reject before treating those nodes as content created by Knockout.
      assertNoReactUnsafeBindings(element)

      // While a content binding remains active, its direct children belong to
      // Knockout. Refresh the snapshot after text/html/component/options updates.
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
  if (value === undefined) {
    element.removeAttribute(name)
  } else {
    element.setAttribute(name, value)
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

  if (names.has('css')) {
    restoreAttribute(element, state.beforeBinding, 'class')
  }
  if (names.has('style')) {
    restoreAttribute(element, state.beforeBinding, 'style')
  } else if (names.has('visible')) {
    element.style.display = state.beforeBinding.styleDisplay
  }
  if (names.has('attr')) {
    for (const name of state.ownedAttributes) {
      if (name !== 'class' && name !== 'style') {
        restoreAttribute(element, state.beforeBinding, name)
      }
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

  const reconcile = (records: MutationRecord[]) => {
    cleanRemovedNodes(records, root)
    const addedRoots = addedBindingRoots(records, root)
    const changedElements = changedBindingElements(records, root, addedRoots)
    recordOwnedAttributeChanges(records, bindingStates)
    refreshOwnedContent(records, changedElements, bindingStates)
    rebindChangedAttributes(changedElements, root, viewModel, bindingStates, addedRoots)
    bindAddedNodes(records, root, viewModel, bindingStates)
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
    // A content binding may be inserting its own DOM, or React may be retiring
    // that binding in the same commit. Let the data-bind mutation or observer
    // callback reconcile those records as one ownership transition.
    shouldDeferInsertion: (parent) =>
      parent.nodeType === Node.ELEMENT_NODE &&
      (bindingStates.get(parent as HTMLElement)?.ownedContent ?? null) !== null,
  })
  observer.observe(root, {
    attributes: true,
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
  }
}

/** Reconciles queued React DOM mutations before descendant layout effects run. */
export function reconcileBindingDescendants(root: HTMLElement) {
  const state = bindingObservers.get(root)
  if (state === undefined || reconcilingRoots.has(root)) {
    return
  }

  const records = state.observer.takeRecords()
  if (records.length === 0) {
    return
  }

  reconcilingRoots.add(root)
  try {
    state.reconcile(records)
  } catch (error) {
    state.observer.disconnect()
    throw error
  } finally {
    reconcilingRoots.delete(root)
  }
}
