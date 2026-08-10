import type * as React from 'react'

const VOID_SEMANTIC_HOSTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
] as const)

type VoidSemanticHost = typeof VOID_SEMANTIC_HOSTS extends Set<infer Host>
  ? Host
  : never

export type SemanticHost = Exclude<keyof HTMLElementTagNameMap, VoidSemanticHost>

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
  if (VOID_SEMANTIC_HOSTS.has(host as VoidSemanticHost)) {
    throw new Error(
      `react-ko cannot use the void HTML element <${host}> as a semantic host because scope hosts always contain children.`
    )
  }

  return host as unknown as React.ComponentType<SemanticHostComponentProps>
}
