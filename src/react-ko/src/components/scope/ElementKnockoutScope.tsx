import * as React from 'react'
import { version as reactVersion } from 'react'
import { useAppViewModel } from '@/index'
import { ScopeViewModelContext } from '@/context/ScopeViewModelContext'
import { ScopeBindGenerationContext } from '@/context/ScopeBindGenerationContext'
import { ELEMENT_BINDING_ROOT_ATTRIBUTE } from './elementBindingRoot'
import { useBindingRoot } from './useBindingRoot'

const FOREIGN_CONTENT_ROOTS = {
  math: true,
  svg: true,
} as const

type ForeignContentRoot = keyof typeof FOREIGN_CONTENT_ROOTS

type IntrinsicHtmlElementName = Exclude<
  {
    [Name in keyof React.JSX.IntrinsicElements]:
      React.JSX.IntrinsicElements[Name] extends React.ClassAttributes<infer Element>
        ? Element extends HTMLElement
          ? Name
          : never
        : never
  }[keyof React.JSX.IntrinsicElements],
  ForeignContentRoot
>

export type BindableElement = React.ReactElement<any, IntrinsicHtmlElementName>

type Props<T> = {
  viewModel: T
  children: BindableElement
}

const REACT_MAJOR = Number.parseInt(reactVersion, 10)

function elementRef(element: BindableElement) {
  if (REACT_MAJOR >= 19) return element.props.ref
  return (element as unknown as { ref?: React.Ref<HTMLElement> }).ref
}

function setRef(
  ref: React.Ref<HTMLElement> | undefined,
  node: HTMLElement | null
) {
  if (typeof ref === 'function') {
    return (ref as (value: HTMLElement | null) => void | (() => void))(node)
  }
  if (ref !== null && ref !== undefined) {
    (ref as React.MutableRefObject<HTMLElement | null>).current = node
  }
}

/** Binds one React-owned host element without adding a DOM host or range. */
export function ElementKnockoutScope<T>({ viewModel, children }: Props<T>) {
  if (
    !React.isValidElement(children) ||
    typeof children.type !== 'string' ||
    FOREIGN_CONTENT_ROOTS[
      children.type.toLowerCase() as ForeignContentRoot
    ] === true
  ) {
    throw new Error(
      'react-ko element binding mode requires one intrinsic HTML element as its child.'
    )
  }

  useAppViewModel()
  const parentGeneration = React.useContext(ScopeBindGenerationContext)
  const [bindingFailure, setBindingFailure] = React.useState<{
    error: unknown
  } | null>(null)
  const handleBindingError = React.useCallback((error: unknown) => {
    setBindingFailure({ error })
  }, [])
  const { bindingContainer, generation } = useBindingRoot(
    viewModel,
    parentGeneration,
    handleBindingError
  )
  const childRef = elementRef(children)
  // One detach path for both majors. Returning a cleanup from this callback would make
  // React 19 skip the null call while React 18 never invokes the cleanup — two exits, one
  // unreachable per major, which no coverage threshold can hold to 100% on either. By
  // returning nothing, both majors call back with null, and a 19-style cleanup returned
  // by the child's own ref is invoked from that shared path instead.
  const childRefCleanup = React.useRef<(() => void) | undefined>(undefined)
  const mergedRef = React.useCallback(
    (node: HTMLElement | null) => {
      if (node !== null) {
        bindingContainer(node)
        const cleanup = setRef(childRef, node)
        childRefCleanup.current = typeof cleanup === 'function' ? cleanup : undefined
        return
      }
      bindingContainer(null)
      const cleanup = childRefCleanup.current
      childRefCleanup.current = undefined
      if (cleanup !== undefined) {
        cleanup()
      } else {
        setRef(childRef, null)
      }
    },
    [bindingContainer, childRef]
  )

  if (bindingFailure !== null) throw bindingFailure.error

  return (
    <ScopeViewModelContext.Provider value={viewModel}>
      <ScopeBindGenerationContext.Provider value={generation}>
        {React.cloneElement(children, {
          ref: mergedRef,
          [ELEMENT_BINDING_ROOT_ATTRIBUTE]: '',
        })}
      </ScopeBindGenerationContext.Provider>
    </ScopeViewModelContext.Provider>
  )
}
