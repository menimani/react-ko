import { useCallback, useContext, useId, useInsertionEffect, useRef, useState } from 'react'
import { ScopeBindGenerationContext } from '@/context/ScopeBindGenerationContext'
import { ELEMENT_BINDING_ROOT_ATTRIBUTE } from '@/components/scope/elementBindingRoot'
import { useBindingRoot } from '@/components/scope/useBindingRoot'

/**
 * What `useKoBind` returns: spread onto the element that is to become the binding
 * root. The attribute marks the element as one, and the ref is what applies and
 * retires its bindings.
 */
export type KoBindProps = {
  ref: (node: HTMLElement | null) => void
  [ELEMENT_BINDING_ROOT_ATTRIBUTE]: string
}

/**
 * The value is quoted inside the selector, so only the quote and the escape character
 * can end it early. `CSS.escape` is absent from some environments this runs in, and
 * escaping the two characters that matter needs no polyfill.
 */
function hostSelector(id: string) {
  return `[${ELEMENT_BINDING_ROOT_ATTRIBUTE}="${id.replace(/["\\]/g, '\\$&')}"]`
}

// Independently rendered roots receive the same default useId sequence. Remember which
// matching SSR host each hook claimed so a later root can select its own unclaimed host.
const hostOwners = new WeakMap<HTMLElement, object>()

function isReactOwnedHost(host: HTMLElement) {
  return Object.getOwnPropertyNames(host).some(
    (name) => name.startsWith('__reactFiber$') || name.startsWith('__reactProps$')
  )
}

function hostsAcrossOpenRoots(
  root: Document | ShadowRoot,
  selector: string,
  visited = new Set<Document | ShadowRoot>()
) {
  if (visited.has(root)) return []
  visited.add(root)

  const hosts = Array.from(root.querySelectorAll<HTMLElement>(selector))
  for (const element of root.querySelectorAll<HTMLElement>('*')) {
    if (element.shadowRoot !== null) {
      hosts.push(...hostsAcrossOpenRoots(element.shadowRoot, selector, visited))
    }
    if (element.localName === 'iframe') {
      let frameDocument: Document | null = null
      try {
        frameDocument = (element as HTMLIFrameElement).contentDocument
      } catch {
        // Cross-origin and sandboxed frames may reject document access.
      }
      if (frameDocument !== null) {
        hosts.push(...hostsAcrossOpenRoots(frameDocument, selector, visited))
      }
    }
  }
  return hosts
}

function isClosedShadowRoot(root: Node): root is ShadowRoot {
  return root.nodeType === 11 && 'host' in root && (root as ShadowRoot).mode === 'closed'
}

function useKoBindRoot<T>(viewModel: T, bindable: boolean): KoBindProps {
  const parentGeneration = useContext(ScopeBindGenerationContext)
  const [failure, setFailure] = useState<{ error: unknown } | null>(null)
  const handleBindingError = useCallback((error: unknown) => {
    setFailure({ error })
  }, [])

  // A nullish view model still runs the binding root: hooks cannot be skipped, and
  // holding one root across the value arriving is what lets the caller keep the props
  // on an element it renders conditionally. The root itself binds nothing while the
  // view model is nullish, and retires a binding it already had.
  const { bindingContainer } = useBindingRoot(
    viewModel,
    parentGeneration,
    handleBindingError,
    bindable
  )

  const boundHost = useRef<HTMLElement | null>(null)
  const hostOwner = useRef<object>({})
  const hostId = useId()

  // React attaches refs from the bottom up, so a host taken from a ref is bound after
  // its own descendants have run their layout effects -- late enough for one of them to
  // write to Knockout-owned DOM that nothing is watching yet. The scope components
  // solved this with an inert element rendered before the host, which a hook cannot do.
  // The attribute is the marker instead: insertion effects run in the mutation phase,
  // with the host already in the document and every layout effect still ahead. Binding
  // a root inside another one first is what the binding root's own ordering handles.
  useInsertionEffect(() => {
    if (!bindable || boundHost.current !== null) return
    const hosts = hostsAcrossOpenRoots(document, hostSelector(hostId)).filter(
      (candidate) =>
        isReactOwnedHost(candidate) &&
        (hostOwners.get(candidate) === undefined ||
          hostOwners.get(candidate) === hostOwner.current)
    )
    // A host in an inaccessible document, a closed shadow root, or a container React has
    // not put in one yet is not reachable from here. Multiple roots can also share a
    // useId, so only prebind when React ownership identifies one eligible host
    // unambiguously. Otherwise its ref still arrives in the layout phase.
    if (hosts.length !== 1) return
    const host = hosts[0]
    hostOwners.set(host, hostOwner.current)
    boundHost.current = host
    bindingContainer(host)
  })

  const ref = useCallback(
    (node: HTMLElement | null) => {
      if (node === null) {
        const held = boundHost.current
        if (held !== null && hostOwners.get(held) === hostOwner.current) {
          hostOwners.delete(held)
        }
        boundHost.current = null
        return
      }

      if (bindable && isClosedShadowRoot(node.getRootNode())) {
        throw new Error(
          'react-ko: useKoBind cannot bind a host inside a closed ShadowRoot before descendant layout effects run. Use KnockoutScope inside the shadow root instead.'
        )
      }

      if (bindable && !node.isConnected) {
        throw new Error(
          'react-ko: useKoBind cannot bind a detached host before descendant layout effects run. Use KnockoutScope inside the detached tree instead.'
        )
      }

      // One call binds one element. Spreading the same props twice would leave the
      // first element bound and unreachable, because a binding root keeps a single
      // host: the second attachment would silently take the first one's place.
      const held = boundHost.current
      if (held !== null && held !== node && held.isConnected) {
        setFailure({
          error: new Error(
            'react-ko: the props returned by one useKoBind call are spread onto more than one element. Call useKoBind once per element.'
          ),
        })
        return
      }

      hostOwners.set(node, hostOwner.current)
      boundHost.current = node
      if (bindable) bindingContainer(node)
    },
    [bindingContainer, bindable]
  )

  if (failure !== null) throw failure.error

  return { ref, [ELEMENT_BINDING_ROOT_ATTRIBUTE]: bindable ? hostId : '' }
}

/**
 * Makes the caller's own element a Knockout binding root for the given view model:
 * `data-bind` inside it is applied against that view model, reapplied when the view
 * model is replaced, and retired with `ko.cleanNode` when the element goes away.
 *
 * The element belongs to the caller. Nothing is added to the DOM, which is what
 * separates this from a component that has to render a host of its own.
 *
 * The host is bound before anything inside it runs a layout effect, so a descendant
 * that writes to Knockout-owned DOM on mount acts on a subtree that is already bound.
 *
 * A nullish view model binds nothing, so an element rendered only while a value
 * exists can hold the props unconditionally:
 *
 * ```tsx
 * const selected = useKoValue(vm.selected)
 * const bind = useKoBind(selected)
 * return selected ? <article {...bind}>…</article> : null
 * ```
 */
export function useKoBind<T>(viewModel: T | null | undefined): KoBindProps {
  return useKoBindRoot(viewModel, viewModel !== null && viewModel !== undefined)
}

/** Internal binding path for structural rows, whose data may itself be nullish. */
export function useKoBindAlways<T>(viewModel: T): KoBindProps {
  return useKoBindRoot(viewModel, true)
}
