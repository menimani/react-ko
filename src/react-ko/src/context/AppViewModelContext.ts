import { createContext, useContext, type Provider } from 'react'

const MISSING_APP_VIEW_MODEL = Symbol('MISSING_APP_VIEW_MODEL')

/**
 * Context to store the global AppViewModel.
 * Intended to be overridden by consumer's ViewModel type.
 */
export const AppViewModelContext = createContext<unknown>(MISSING_APP_VIEW_MODEL)

/**
 * A Provider and hook whose ViewModel type is fixed by the same factory call.
 */
export type AppViewModelContextHandle<T> = {
  Provider: Provider<T>
  useAppViewModel: () => T
}

/**
 * Creates a type-safe application ViewModel Provider and its matching hook.
 */
export function createAppViewModelContext<T>(): AppViewModelContextHandle<T> {
  const Context = createContext<T | typeof MISSING_APP_VIEW_MODEL>(MISSING_APP_VIEW_MODEL)

  function useTypedAppViewModel(): T {
    const context = useContext(Context)
    if (context === MISSING_APP_VIEW_MODEL) {
      throw new Error('useAppViewModel must be used within its matching Provider.')
    }
    return context
  }

  return {
    Provider: Context.Provider as Provider<T>,
    useAppViewModel: useTypedAppViewModel,
  }
}

/**
 * Hook to access the current AppViewModel.
 * Must be used within an AppViewModelContext.Provider.
 *
 * @deprecated This generic is an unchecked type assertion. Use
 * createAppViewModelContext<T>() and its matching Provider and hook instead.
 */
export function useAppViewModel<T>(): T {
  const context = useContext(AppViewModelContext)
  if (context === MISSING_APP_VIEW_MODEL) {
    throw new Error('useAppViewModel must be used within an AppViewModelContext.Provider.')
  }
  return context as T
}
