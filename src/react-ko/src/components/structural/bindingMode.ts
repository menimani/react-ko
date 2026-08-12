import type { BindableElement } from '@/components/scope/ElementKnockoutScope'
import type { SemanticHostProps } from '@/components/scope/semanticHost'

export type HostedBindingProps = SemanticHostProps & {
  /** Uses the existing two-host scope. This is the default. */
  bindingMode?: 'hosted'
}

export type ElementBindingProps = {
  /** Binds the one intrinsic child element directly, without DOM hosts. */
  bindingMode: 'element'
  boundaryAs?: never
  as?: never
}

export type ElementChild = BindableElement
