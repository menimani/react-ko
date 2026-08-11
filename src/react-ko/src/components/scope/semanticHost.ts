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

const NON_VOID_SEMANTIC_HOSTS: ReadonlySet<string> = new Set(
  NON_VOID_SEMANTIC_HOST_NAMES
)

const RESERVED_CUSTOM_ELEMENT_NAMES = new Set([
  'annotation-xml',
  'color-profile',
  'font-face',
  'font-face-src',
  'font-face-uri',
  'font-face-format',
  'font-face-name',
  'missing-glyph',
])

const CUSTOM_ELEMENT_NAME =
  /^[a-z][.0-9_a-z\-\u00b7\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u037d\u037f-\u1fff\u200c-\u200d\u203f-\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd\u{10000}-\u{effff}]*-[.0-9_a-z\-\u00b7\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u037d\u037f-\u1fff\u200c-\u200d\u203f-\u2040\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd\u{10000}-\u{effff}]*$/u

function isCustomElementHost(host: string) {
  return CUSTOM_ELEMENT_NAME.test(host) && !RESERVED_CUSTOM_ELEMENT_NAMES.has(host)
}

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

  if (!NON_VOID_SEMANTIC_HOSTS.has(host) && !isCustomElementHost(host)) {
    throw new Error(
      `react-ko cannot use <${String(host)}> as a semantic host because scope hosts require a non-void HTML element.`
    )
  }

  return host as unknown as React.ComponentType<SemanticHostComponentProps>
}
