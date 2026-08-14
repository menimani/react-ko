import * as React from 'react'
import { KnockoutScope } from '@/index'

type Props<T> = {
  viewModel: T
  children?: React.ReactNode
}

export function BindingHost<T>({ viewModel, children }: Props<T>) {
  return <KnockoutScope viewModel={viewModel}>{children}</KnockoutScope>
}
