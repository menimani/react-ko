import React from 'react'
import { KnockoutScope } from '../../../KnockoutScope'
import { HtmlComment } from './HtmlComment'

type Props = {
  condition: KnockoutObservable<boolean> | boolean
  children: React.ReactNode
}

/**
 * Wraps children with Knockout comment-based `if:` bindings.
 * Suitable for maintaining compatibility with KO template logic.
 * Renders `<!-- ko if: condition -->...<!-- /ko -->` around children.
 */
export const KoIfComment = React.memo(function KoIfComment({ condition, children }: Props) {
  const vm = { condition }

  return (
    <KnockoutScope viewModel={vm}>
      <HtmlComment text="ko if: condition" />
      {children}
      <HtmlComment text="/ko" />
    </KnockoutScope>
  )
})