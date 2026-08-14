import * as React from 'react'
import { useKoBind, type KoBindProps } from '../../dist/index.js'

type Assert<T extends true> = T

type RefTakesAnHtmlHost = Assert<
  KoBindProps['ref'] extends (node: HTMLElement | null) => void ? true : false
>

type MarksTheBindingRoot = Assert<
  KoBindProps extends { 'data-react-ko-scope': string } ? true : false
>

export function HtmlHost() {
  const bind = useKoBind({ label: 'Bound' })
  return <div {...bind} />
}

export function NullishViewModel() {
  const bind = useKoBind<{ label: string } | null>(null)
  return <section {...bind} />
}

export function ForeignContentHost() {
  const bind = useKoBind({ label: 'Bound' })
  // A binding host is an HTML element. The type rejects SVG and MathML roots, and
  // the runtime guard protects JavaScript consumers that do not have this check.
  // @ts-expect-error an SVG root cannot be a react-ko binding host
  return <svg {...bind} />
}
