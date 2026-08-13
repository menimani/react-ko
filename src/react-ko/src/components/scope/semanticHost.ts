import type * as React from 'react'

const REJECTED_SEMANTIC_HOSTS = {
  area: 'void',
  base: 'void',
  br: 'void',
  col: 'void',
  embed: 'void',
  hr: 'void',
  img: 'void',
  input: 'void',
  link: 'void',
  meta: 'void',
  param: 'void',
  source: 'void',
  track: 'void',
  wbr: 'void',
  math: 'foreign-content',
  svg: 'foreign-content',
  textarea: 'text-content',
  title: 'text-content',
  template: 'template-content',
  script: 'inert-children',
  head: 'hoisted',
  body: 'hoisted',
  html: 'hoisted',
  keygen: 'ssr',
} as const

type RejectedSemanticHost = keyof typeof REJECTED_SEMANTIC_HOSTS

/**
 * The names this module rejects as foreign content. Element binding mode rejects the
 * same ones, and derives both its type and its runtime guard from here so a host is
 * never classified in two places.
 */
export type ForeignContentHost = {
  [Name in RejectedSemanticHost]: (typeof REJECTED_SEMANTIC_HOSTS)[Name] extends 'foreign-content'
    ? Name
    : never
}[RejectedSemanticHost]

export function isForeignContentHost(name: string) {
  return (
    REJECTED_SEMANTIC_HOSTS[name.toLowerCase() as RejectedSemanticHost] ===
    'foreign-content'
  )
}

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
  | Exclude<keyof HTMLElementTagNameMap, RejectedSemanticHost>

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
  const rejection =
    REJECTED_SEMANTIC_HOSTS[normalizedHost as RejectedSemanticHost]

  // Declaration merging is erased at runtime, so unknown names must be passed
  // through to React for the public SemanticHost type to remain usable.
  switch (rejection) {
    case 'void':
      throw new Error(
        `react-ko cannot use the void HTML element <${host}> as a semantic host because scope hosts always contain children.`
      )
    case 'foreign-content':
      throw new Error(
        `react-ko cannot use <${String(host)}> as a semantic host because scope hosts require a non-void HTML element.`
      )
    case 'text-content':
      throw new Error(
        `react-ko cannot use <${String(host)}> as a semantic host because scope hosts require an HTML element that preserves its child element subtree.`
      )
    case 'template-content':
      throw new Error(
        `react-ko cannot use <${String(host)}> as a semantic host because a scope host must keep its children in the document tree, but a <template>'s children live in its content fragment.`
      )
    case 'inert-children':
      throw new Error(
        `react-ko cannot use <${String(host)}> as a semantic host because inert children cannot hold a live binding scope.`
      )
    case 'hoisted':
      throw new Error(
        `react-ko cannot use <${String(host)}> as a semantic host because it is hoisted out of the scope that contains it.`
      )
    case 'ssr':
      throw new Error(
        `react-ko cannot use <${String(host)}> as a semantic host because it is unable to survive SSR.`
      )
  }

  return host as unknown as React.ComponentType<SemanticHostComponentProps>
}
