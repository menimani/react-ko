import { createContext, useContext } from 'react'

/**
 * Carries the view model of the nearest enclosing KnockoutScope (or the
 * root view model when none is above). Internal to the library: components
 * that mount children after the initial render use it to bind those
 * children against the ambient scope. Not exported from the package.
 */
export const ScopeViewModelContext = createContext<unknown>(undefined)

/**
 * Returns the view model of the nearest enclosing scope.
 */
export function useScopeViewModel(): unknown {
  return useContext(ScopeViewModelContext)
}
