import { createContext } from 'react'

/** Returns the nearest enclosing DOM root once its Knockout binding is active. */
export const ScopeBindingRootContext = createContext<() => HTMLElement | null>(
  () => null
)
