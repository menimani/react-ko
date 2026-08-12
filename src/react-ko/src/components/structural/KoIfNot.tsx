import * as React from 'react'
import type * as ko from 'knockout'
import { KnockoutScope, useKoValue } from '@/index'
import { useScopeViewModel } from '@/context/ScopeViewModelContext'
import { ElementKnockoutScope } from '@/components/scope/ElementKnockoutScope'
import type {
  ElementBindingProps,
  ElementChild,
  HostedBindingProps,
} from './bindingMode'

type CommonProps = {
  condition: ko.Observable<boolean> | ko.Computed<boolean> | boolean
}

type Props = CommonProps & (
  | (HostedBindingProps & { children: React.ReactNode })
  | (ElementBindingProps & { children: ElementChild })
)

/**
 * Renders children only while the condition is false. The children are
 * wrapped in a scope bound to the enclosing view model on every mount,
 * so `data-bind` attributes inside keep working across toggles.
 */
export const KoIfNot = React.memo(function KoIfNot(props: Props) {
  const visible = useKoValue(props.condition)
  const viewModel = useScopeViewModel()

  if (visible) {
    return null
  }

  return props.bindingMode === 'element' ? (
    <ElementKnockoutScope viewModel={viewModel}>
      {props.children}
    </ElementKnockoutScope>
  ) : (
    <KnockoutScope
      viewModel={viewModel}
      boundaryAs={props.boundaryAs}
      as={props.as}
    >
      {props.children}
    </KnockoutScope>
  )
})
