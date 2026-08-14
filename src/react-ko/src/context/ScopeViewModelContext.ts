import { createContext } from 'react'

export const MISSING_SCOPE_VIEW_MODEL = Symbol('MISSING_SCOPE_VIEW_MODEL')

/** Carries the view model of the nearest enclosing KnockoutScope. */
export const ScopeViewModelContext = createContext<unknown>(
  MISSING_SCOPE_VIEW_MODEL
)
