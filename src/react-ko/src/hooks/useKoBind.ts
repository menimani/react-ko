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
  const parentGeneration = useContext(ScopeBindGenerationContext)
  const [failure, setFailure] = useState<{ error: unknown } | null>(null)
  const handleBindingError = useCallback((error: unknown) => {
    setFailure({ error })
  }, [])

  // A nullish view model still runs the binding root: hooks cannot be skipped, and
  // holding one root across the value arriving is what lets the caller keep the props
  // on an element it renders conditionally. Nothing binds until a host is attached.
  const { bindingContainer } = useBindingRoot(
    viewModel,
    parentGeneration,
    handleBindingError
  )

  const boundHost = useRef<HTMLElement | null>(null)
  const bindable = viewModel !== null && viewModel !== undefined
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
    const host = document.querySelector<HTMLElement>(hostSelector(hostId))
    // A host rendered into another document, or into a container React has not put in
    // one yet, is not reachable from here. Its ref still arrives in the layout phase.
    if (host === null) return
    boundHost.current = host
    bindingContainer(host)
  })

  const ref = useCallback(
    (node: HTMLElement | null) => {
      if (node === null) {
        boundHost.current = null
        return
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

      boundHost.current = node
      if (bindable) bindingContainer(node)
    },
    [bindingContainer, bindable]
  )

  if (failure !== null) throw failure.error

  return { ref, [ELEMENT_BINDING_ROOT_ATTRIBUTE]: hostId }
}
