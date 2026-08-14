import * as React from 'react'
import { useKoBindFallback } from '@/hooks/useKoBind'

type Props<T> = {
  viewModel: T
  children?: React.ReactNode
  as?: keyof React.JSX.IntrinsicElements
} & Record<string, unknown>

export function BindingHost<T>({ viewModel, children, as, ...rest }: Props<T>) {
  const bind = useKoBindFallback(viewModel)
  return React.createElement(as ?? 'div', { ...bind, ...rest }, children)
}
