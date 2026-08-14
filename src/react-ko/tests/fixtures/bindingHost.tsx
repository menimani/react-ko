import * as React from 'react'
import { useKoBind } from '@/index'

type Props<T> = {
  viewModel: T
  children?: React.ReactNode
  as?: keyof React.JSX.IntrinsicElements
} & Record<string, unknown>

export function BindingHost<T>({ viewModel, children, as, ...rest }: Props<T>) {
  const bind = useKoBind(viewModel)
  return React.createElement(as ?? 'div', { ...bind, ...rest }, children)
}
