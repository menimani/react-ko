import { createContext, useContext } from 'react'

/**
 * Context to store the global AppViewModel.
 * Intended to be overridden by consumer's ViewModel type.
 */
export const AppViewModelContext = createContext<unknown | null>(null)

/**
 * Hook to access the current AppViewModel.
 * Must be used within a RootKnockoutProvider.
 */
export function useAppViewModel<T>(): T {
  const context = useContext(AppViewModelContext)
  if (context === null) {
    throw new Error('useAppViewModel must be used within a RootKnockoutProvider.')
  }
  return context as T
}