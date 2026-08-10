import { createContext, useContext } from 'react'

const MISSING_APP_VIEW_MODEL = Symbol('MISSING_APP_VIEW_MODEL')

/**
 * Context to store the global AppViewModel.
 * Intended to be overridden by consumer's ViewModel type.
 */
export const AppViewModelContext = createContext<unknown>(MISSING_APP_VIEW_MODEL)

/**
 * Hook to access the current AppViewModel.
 * Must be used within an AppViewModelContext.Provider.
 */
export function useAppViewModel<T>(): T {
  const context = useContext(AppViewModelContext)
  if (context === MISSING_APP_VIEW_MODEL) {
    throw new Error('useAppViewModel must be used within an AppViewModelContext.Provider.')
  }
  return context as T
}
