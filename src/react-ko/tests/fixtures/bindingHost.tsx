import * as React from 'react'
import { useKoBind } from '@/index'

type Props<T> = {
  viewModel: T
  children?: React.ReactNode
  /** The element to bind. A div by default, as the removed scope hosts were. */
  as?: keyof React.JSX.IntrinsicElements
} & Record<string, unknown>

/**
 * A binding root rendered as one element, for the suites that used to reach for
 * `RootKnockoutProvider` or `KnockoutScope`. The library renders no host of its own
 * any more, so a test that needs one supplies it here rather than through the package.
 *
 * Nothing about it is special: it is `useKoBind` spread onto an element, which is what
 * a consumer writes.
 */
export function BindingHost<T>({ viewModel, children, as, ...rest }: Props<T>) {
  const bind = useKoBind(viewModel)
  return React.createElement(as ?? 'div', { ...bind, ...rest }, children)
}
