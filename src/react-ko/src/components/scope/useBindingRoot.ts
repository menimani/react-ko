import {
  createElement,
  useCallback,
  useEffect,
  useId,
  useInsertionEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import ko from 'knockout'
import { applyBindingsSafely } from './applyBindingsSafely'
import {
  observeBindingDescendants,
  prepareBindingDescendants,
  reconcileBindingDescendants,
  refreshBindingDescendantsAfterLayout,
  restoreDescendantBindingRoots,
} from './observeBindingDescendants'

type ActiveBinding = {
  node: HTMLElement
  viewModel: unknown
  parentGeneration: number
  stopObserving: () => void
  releaseTemplateAttachmentCheck?: () => void
}

const UNBOUND_BINDING = Symbol('unbound')
const subscribeToNothing = () => () => undefined
const getClientSnapshot = () => false
const getServerSnapshot = () => true
const TEMPLATE_ATTACHMENT_CHECK = Symbol.for(
  'react-ko.templateContentAttachmentCheck'
)

type TemplateAttachmentCheckRegistry = {
  owners: number
  key: string
  original: (node: Node) => boolean
  patched: (node: Node) => boolean
}

function retainTemplateAttachmentCheck() {
  const utils = ko.utils as typeof ko.utils & Record<string, unknown> & {
    [TEMPLATE_ATTACHMENT_CHECK]?: TemplateAttachmentCheckRegistry
  }
  let registry = utils[TEMPLATE_ATTACHMENT_CHECK]
  if (registry === undefined) {
    // Parsed template contents use an inert owner document with no
    // documentElement. Knockout's private attachment check assumes one exists,
    // so locate the debug or minified method by its stable DOM expression.
    const attachmentCheck = Object.entries(utils).find(
      ([, candidate]) =>
        typeof candidate === 'function' &&
        Function.prototype.toString
          .call(candidate)
          .includes('ownerDocument.documentElement')
    )
    if (attachmentCheck === undefined) {
      throw new Error(
        'react-ko could not prepare Knockout bindings for hydrated <template> content.'
      )
    }
    const [key, originalValue] = attachmentCheck
    const original = originalValue as (node: Node) => boolean
    const patched = (node: Node) =>
      node.ownerDocument.documentElement === null || original(node)
    registry = { owners: 0, key, original, patched }
    utils[TEMPLATE_ATTACHMENT_CHECK] = registry
    utils[key] = patched
  }
  registry.owners += 1

  return () => {
    if (registry === undefined) return
    registry.owners -= 1
    if (registry.owners !== 0) return
    if (utils[registry.key] === registry.patched) {
      utils[registry.key] = registry.original
    }
    delete utils[TEMPLATE_ATTACHMENT_CHECK]
  }
}

function hasReactTag(node: Node) {
  for (const name of Object.getOwnPropertyNames(node)) {
    if (name.startsWith('__reactFiber$') || name.startsWith('__reactProps$')) {
      return true
    }
  }
  return false
}

function belongsToReactRoot(node: Node) {
  for (
    let current: Node | null = node;
    current !== null;
    current = current.parentNode
  ) {
    if (
      Object.getOwnPropertyNames(current).some((name) =>
        name.startsWith('__reactContainer$')
      )
    ) {
      return true
    }
  }
  return false
}

function BindingCommitMarker({
  onCommit,
  onActivate,
  hydrationId,
}: {
  onCommit: () => void
  onActivate: (node: HTMLElement | null) => void
  hydrationId?: string
}) {
  useInsertionEffect(onCommit)
  return createElement('template', {
    'data-react-ko-hydration': hydrationId,
    ref: (marker: HTMLTemplateElement | null) => {
      onActivate((marker?.nextElementSibling as HTMLElement | null) ?? null)
    },
  })
}

export function useBindingRoot(
  viewModel: unknown,
  parentGeneration: number,
  onError: (error: unknown) => void,
  notifyBindingEstablished = false,
  bindingIdentity: unknown = undefined,
  templateHost = false
) {
  const containerNode = useRef<HTMLElement | null>(null)
  const activeBinding = useRef<ActiveBinding | null>(null)
  const pendingBindingReplacement = useRef(false)
  const replacedBinding = useRef(false)
  const bindingEstablishedIdentity = useRef<unknown>(UNBOUND_BINDING)
  const synchronizeBindingForCommit = useRef(synchronizeBinding)
  const refreshInitialBinding = useRef(false)
  const [, setBindingEstablishedVersion] = useState(0)
  const [generation, setGeneration] = useState(0)
  const hydrationId = useId()
  const [hydratedTemplate] = useState(() => {
    if (!templateHost || typeof document === 'undefined') return false

    // An unclaimed marker beneath a container already registered by
    // hydrateRoot identifies this render without confusing a later SSR pass
    // with an already-mounted root that happens to reuse the same useId.
    for (const marker of document.querySelectorAll<HTMLTemplateElement>(
      'template[data-react-ko-hydration]'
    )) {
      if (
        marker.dataset.reactKoHydration !== hydrationId ||
        hasReactTag(marker) ||
        !belongsToReactRoot(marker)
      ) {
        continue
      }
      const host = marker.nextElementSibling
      const view = host?.ownerDocument.defaultView
      return (
        host !== null &&
        view !== null &&
        view !== undefined &&
        host instanceof view.HTMLTemplateElement &&
        host.content.hasChildNodes()
      )
    }
    return false
  })
  const hydratedTemplateIdentity = useRef(bindingIdentity)
  const hydratedTemplateActive = useRef(hydratedTemplate)
  if (
    hydratedTemplateActive.current &&
    (!templateHost ||
      !Object.is(hydratedTemplateIdentity.current, bindingIdentity))
  ) {
    hydratedTemplateActive.current = false
  }
  const preserveHydratedTemplate = hydratedTemplateActive.current
  const preserveHydratedTemplateRef = useRef(preserveHydratedTemplate)
  preserveHydratedTemplateRef.current = preserveHydratedTemplate
  const hydratedTemplateContainer = useRef<HTMLElement | null>(null)
  const preserveServerChildren = useSyncExternalStore(
    subscribeToNothing,
    getClientSnapshot,
    getServerSnapshot
  )

  function disposeBinding() {
    const active = activeBinding.current
    if (active === null) {
      return
    }

    active.stopObserving()
    ko.cleanNode(active.node)
    active.releaseTemplateAttachmentCheck?.()
    activeBinding.current = null
  }

  function bind(node: HTMLElement, replacing: boolean) {
    const releaseTemplateAttachmentCheck =
      node === hydratedTemplateContainer.current
        ? retainTemplateAttachmentCheck()
        : undefined
    try {
      const bindingStates = prepareBindingDescendants(node)
      const deferredSuspenseBindings = applyBindingsSafely(viewModel, node)
      const stopObserving = observeBindingDescendants(
        viewModel,
        node,
        onError,
        bindingStates,
        () => pendingBindingReplacement.current,
        deferredSuspenseBindings
      )
      activeBinding.current = {
        node,
        viewModel,
        parentGeneration,
        stopObserving,
        releaseTemplateAttachmentCheck,
      }
    } catch (error) {
      releaseTemplateAttachmentCheck?.()
      throw error
    }
    if (
      notifyBindingEstablished &&
      !Object.is(bindingEstablishedIdentity.current, bindingIdentity)
    ) {
      bindingEstablishedIdentity.current = bindingIdentity
      setBindingEstablishedVersion((current) => current + 1)
    }

    if (replacing) {
      // Cleaning an ancestor also cleans nested binding roots. Restore them now
      // so their layout effects never observe a temporarily unbound subtree.
      restoreDescendantBindingRoots(node, node)
      replacedBinding.current = true
    }
  }

  function synchronizeBinding() {
    const node = containerNode.current
    if (node === null) {
      return
    }

    const active = activeBinding.current
    if (active !== null) {
      if (
        active.node === node &&
        Object.is(active.viewModel, viewModel) &&
        active.parentGeneration === parentGeneration
      ) {
        pendingBindingReplacement.current = false
        // React has already committed data-bind changes by this phase. Retire
        // their old subscriptions before any descendant layout effect can run.
        reconcileBindingDescendants(active.node)
        return
      }

      disposeBinding()
      pendingBindingReplacement.current = false
      bind(node, true)
      return
    }

    bind(node, false)
  }

  // The inert template precedes the binding host inside the structural
  // boundary. Its ref is attached before the host's descendants run layout
  // effects without changing the caller-visible child subtree.
  const prepareBindingHost = useCallback((node: HTMLElement | null) => {
    if (node === null) return
    if (preserveHydratedTemplateRef.current) {
      const template = node as HTMLTemplateElement
      let contentContainer = hydratedTemplateContainer.current
      if (contentContainer === null) {
        // React cannot traverse template.content during hydration. Keep those
        // server nodes there and bind them through the same display:contents
        // structural container used by ordinary binding roots.
        contentContainer = template.ownerDocument.createElement('div')
        contentContainer.style.display = 'contents'
        contentContainer.append(...template.content.childNodes)
        template.content.append(contentContainer)
        hydratedTemplateContainer.current = contentContainer
      }
      containerNode.current = contentContainer
    } else {
      containerNode.current = node
    }
  }, [])

  const activateBindingHost = useCallback((node: HTMLElement | null) => {
    if (node === null) return
    prepareBindingHost(node)
    const hadActiveBinding = activeBinding.current !== null
    synchronizeBindingForCommit.current()
    refreshInitialBinding.current =
      !hadActiveBinding && activeBinding.current !== null
  }, [])

  const bindingCommitMarker = createElement(BindingCommitMarker, {
    hydrationId: templateHost ? hydrationId : undefined,
    onCommit: () => {
      synchronizeBindingForCommit.current = synchronizeBinding
      const active = activeBinding.current
      pendingBindingReplacement.current =
        active !== null &&
        (!Object.is(active.viewModel, viewModel) ||
          active.parentGeneration !== parentGeneration)
    },
    onActivate: activateBindingHost,
  })

  // On updates, refs are already attached and insertion effects run before all
  // layout effects. The layout pass remains as a fallback for the host ref and
  // for commits where the first-child marker did not attach.
  useInsertionEffect(synchronizeBinding)

  useLayoutEffect(() => {
    synchronizeBinding()

    if (replacedBinding.current) {
      replacedBinding.current = false
      setGeneration((current) => current + 1)
    }
  })

  // An enclosing component's layout effect runs after this root and can write
  // React-owned DOM. Refresh the initial pass after the whole layout phase so
  // Knockout ownership remains consistent without delaying descendant refs.
  useEffect(() => {
    if (!refreshInitialBinding.current) {
      synchronizeBinding()
      return
    }

    refreshInitialBinding.current = false
    const node = containerNode.current
    if (node === null) return
    refreshBindingDescendantsAfterLayout(node)
  })

  useLayoutEffect(
    () => () => {
      disposeBinding()
    },
    []
  )

  return {
    container: templateHost ? prepareBindingHost : containerNode,
    bindingCommitMarker,
    generation,
    bindingEstablished: Object.is(
      bindingEstablishedIdentity.current,
      bindingIdentity
    ),
    preserveServerChildren,
    preserveHydratedTemplate,
  }
}
