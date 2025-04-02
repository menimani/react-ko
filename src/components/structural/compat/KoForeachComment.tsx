import React from 'react'
import { KnockoutScope } from '../../../KnockoutScope'
import { HtmlComment } from './HtmlComment'

type Props = {
  items: KnockoutObservable<unknown[]> | unknown[]
  children: React.ReactNode
}

/**
 * Renders children with Knockout's comment-based `foreach:` binding.
 * Useful for template compatibility scenarios.
 */
export const KoForeachComment = React.memo(function KoForeachComment({ items, children }: Props) {
  const vm = { items }

  return (
    <KnockoutScope viewModel={vm}>
      <HtmlComment text="ko foreach: items" />
      {children}
      <HtmlComment text="/ko" />
    </KnockoutScope>
  )
})
