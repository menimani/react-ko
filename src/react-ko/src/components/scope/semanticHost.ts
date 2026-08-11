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

const NON_VOID_SEMANTIC_HOST_NAMES = [
  'acronym',
  'applet',
  'big',
  'blink',
  'center',
  'dir',
  'font',
  'frameset',
  'listing',
  'marquee',
  'multicol',
  'nobr',
  'noembed',
  'noframes',
  'plaintext',
  'rb',
  'rtc',
  'strike',
  'tt',
  'xmp',
] as const

type NonVoidSemanticHost = (typeof NON_VOID_SEMANTIC_HOST_NAMES)[number]

export type SemanticHost =
  | NonVoidSemanticHost
  | Exclude<keyof HTMLElementTagNameMap, VoidSemanticHost>

const FOREIGN_CONTENT_HOSTS: ReadonlySet<string> = new Set(['math', 'svg'])

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
  const normalizedHost = String(host).toLowerCase()

  if (VOID_SEMANTIC_HOSTS.has(normalizedHost as VoidSemanticHost)) {
    throw new Error(
      `react-ko cannot use the void HTML element <${host}> as a semantic host because scope hosts always contain children.`
    )
  }

  // Declaration merging is erased at runtime, so unknown names must be passed
  // through to React for the public SemanticHost type to remain usable.
  if (FOREIGN_CONTENT_HOSTS.has(normalizedHost)) {
    throw new Error(
      `react-ko cannot use <${String(host)}> as a semantic host because scope hosts require a non-void HTML element.`
    )
  }

  return host as unknown as React.ComponentType<SemanticHostComponentProps>
}
