import { createContext } from 'react'

/**
 * Counts how many times the nearest enclosing KnockoutScope has re-applied
 * its bindings. An ancestor's ko.cleanNode disposes every nested binding,
 * and its re-applied pass stops at nested scope boundaries, so descendants
 * watch this value to know they must rebind themselves. Internal to the
 * library; not exported from the package.
 */
export const ScopeBindGenerationContext = createContext(0)
