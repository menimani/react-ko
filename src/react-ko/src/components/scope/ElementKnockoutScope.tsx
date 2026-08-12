import * as React from 'react'
import { version as reactVersion } from 'react'
import { useAppViewModel } from '@/index'
import { ScopeViewModelContext } from '@/context/ScopeViewModelContext'
import { ScopeBindGenerationContext } from '@/context/ScopeBindGenerationContext'
import { ELEMENT_BINDING_ROOT_ATTRIBUTE } from './elementBindingRoot'
import { useBindingRoot } from './useBindingRoot'

export type BindableElement = React.ReactElement<any, string>

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
  if (!React.isValidElement(children) || typeof children.type !== 'string') {
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
  const mergedRef = React.useCallback(
    (node: HTMLElement | null) => {
      bindingContainer(node)
      const cleanup = setRef(childRef, node)
      return typeof cleanup === 'function'
        /* v8 ignore next -- React 18 does not invoke callback-ref cleanups. */
        ? () => {
            cleanup()
            bindingContainer(null)
          }
        : undefined
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
