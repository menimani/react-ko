import type * as React from 'react'

export type SemanticHost = keyof HTMLElementTagNameMap

export type SemanticHostProps = {
  /** Element that prevents an enclosing Knockout root from binding this scope. */
  boundaryAs?: SemanticHost
  /** Element to which this scope's Knockout bindings are applied. */
  as?: SemanticHost
}

type SemanticHostComponentProps = {
  children: React.ReactNode
  style: React.CSSProperties
  ref?: React.Ref<HTMLElement>
  'data-bind'?: string
}

export function semanticHostComponent(host: SemanticHost) {
  return host as unknown as React.ComponentType<SemanticHostComponentProps>
}
