import { useContext } from 'react'
import {
  MISSING_SCOPE_VIEW_MODEL,
  ScopeViewModelContext,
} from '@/context/ScopeViewModelContext'

/** Returns the view model of the nearest enclosing KnockoutScope. */
export function useKoViewModel<T>(): T {
  const viewModel = useContext(ScopeViewModelContext)
  if (viewModel === MISSING_SCOPE_VIEW_MODEL) {
    throw new Error(
      'react-ko: useKoViewModel must be used within a KnockoutScope.'
    )
  }
  return viewModel as T
}
