import type * as React from 'react'

const VOID_SEMANTIC_HOSTS = new Set([
  'area',
  'base',
  'basefont',
  'bgsound',
  'br',
  'col',
  'embed',
  'frame',
  'hr',
  'img',
  'input',
  'keygen',
  'link',
  'menuitem',
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
  'a',
  'abbr',
  'acronym',
  'address',
  'applet',
  'article',
  'aside',
  'audio',
  'b',
  'bdi',
  'bdo',
  'big',
  'blink',
  'blockquote',
  'body',
  'button',
  'canvas',
  'caption',
  'center',
  'cite',
  'code',
  'colgroup',
  'data',
  'datalist',
  'dd',
  'del',
  'details',
  'dfn',
  'dialog',
  'dir',
  'div',
  'dl',
  'dt',
  'em',
  'fieldset',
  'figcaption',
  'figure',
  'font',
  'footer',
  'form',
  'frameset',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'head',
  'header',
  'hgroup',
  'html',
  'i',
  'iframe',
  'ins',
  'kbd',
  'label',
  'legend',
  'li',
  'listing',
  'main',
  'map',
  'mark',
  'marquee',
  'menu',
  'meter',
  'multicol',
  'nav',
  'nobr',
  'noembed',
  'noframes',
  'noscript',
  'object',
  'ol',
  'optgroup',
  'option',
  'output',
  'p',
  'picture',
  'plaintext',
  'pre',
  'progress',
  'q',
  'rb',
  'rp',
  'rt',
  'rtc',
  'ruby',
  's',
  'samp',
  'script',
  'search',
  'section',
  'select',
  'slot',
  'small',
  'span',
  'strike',
  'strong',
  'style',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'template',
  'textarea',
  'tfoot',
  'th',
  'thead',
  'time',
  'title',
  'tr',
  'tt',
  'u',
  'ul',
  'var',
  'video',
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
  if (VOID_SEMANTIC_HOSTS.has(host as VoidSemanticHost)) {
    throw new Error(
      `react-ko cannot use the void HTML element <${host}> as a semantic host because scope hosts always contain children.`
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
