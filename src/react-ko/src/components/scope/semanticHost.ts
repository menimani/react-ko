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

// The HTML parser either drops these elements' descendants or treats their
// markup as text, so server output cannot reconstruct the tree React hydrates.
const PARSER_SPECIAL_HOSTS: ReadonlySet<string> = new Set([
  'frameset',
  'iframe',
  'noembed',
  'noframes',
  'noscript',
  'plaintext',
  'script',
  'style',
  'template',
  'textarea',
  'title',
  'xmp',
])

// These obsolete elements remain in HTMLElementTagNameMap, but cannot safely
// contain a scope subtree in React or parsed server markup.
const LEGACY_CHILDLESS_HOSTS: ReadonlySet<string> = new Set([
  'frame',
  'basefont',
  'bgsound',
  'keygen',
  'menuitem',
])

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

  if (LEGACY_CHILDLESS_HOSTS.has(host)) {
    throw new Error(
      `react-ko cannot use the legacy childless HTML element <${String(host)}> as a semantic host because scope hosts always contain children.`
    )
  }

  if (PARSER_SPECIAL_HOSTS.has(host)) {
    throw new Error(
      `react-ko cannot use the parser-special HTML element <${String(host)}> as a semantic host because its children cannot be hydrated reliably.`
    )
  }

  // Declaration merging is erased at runtime, so unknown names must be passed
  // through to React for the public SemanticHost type to remain usable.
  if (FOREIGN_CONTENT_HOSTS.has(host)) {
    throw new Error(
      `react-ko cannot use <${String(host)}> as a semantic host because scope hosts require a non-void HTML element.`
    )
  }

  return host as unknown as React.ComponentType<SemanticHostComponentProps>
}
