import * as React from 'react'
import type * as ko from 'knockout'
import { KnockoutScope, useKoValue } from '@/index'
import { ElementKnockoutScope } from '@/components/scope/ElementKnockoutScope'
import type {
  ElementBindingProps,
  ElementChild,
  HostedBindingProps,
} from './bindingMode'

type CommonProps<T> = {
  value: ko.Observable<T> | ko.Computed<T> | T
}

type Props<T> = CommonProps<T> & (
  | (HostedBindingProps & {
      children: (value: NonNullable<T>) => React.ReactNode
    })
  | (ElementBindingProps & {
      children: (value: NonNullable<T>) => ElementChild
    })
)

/**
 * Renders the render prop for a non-nullish value and binds the returned JSX
 * to that value. React owns mounting and unmounting the children; Knockout is
 * only responsible for bindings inside the resulting scope.
 */
export function KoWith<T>(props: Props<T>) {
  const current = useKoValue<T>(props.value)

  if (current === null || current === undefined) {
    return null
  }

  return props.bindingMode === 'element' ? (
    <ElementKnockoutScope viewModel={current}>
      {props.children(current)}
    </ElementKnockoutScope>
  ) : (
    <KnockoutScope
      viewModel={current}
      boundaryAs={props.boundaryAs}
      as={props.as}
    >
      {props.children(current)}
    </KnockoutScope>
  )
}
