import React from 'react'
import { KnockoutScope } from '../../../KnockoutScope'
import { HtmlComment } from './HtmlComment'

type Props = {
  condition: KnockoutObservable<boolean> | boolean
  children: React.ReactNode
}

/**
 * Renders children with Knockout's comment-based `ifnot:` binding.
 * Useful for compatibility with template-based KO structures.
 */
export const KoIfNotComment = React.memo(function KoIfNotComment({ condition, children }: Props) {
  const vm = { condition }

  return (
    <KnockoutScope viewModel={vm}>
      <HtmlComment text="ko ifnot: condition" />
      {children}
      <HtmlComment text="/ko" />
    </KnockoutScope>
  )
})