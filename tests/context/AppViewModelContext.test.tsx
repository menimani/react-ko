import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'
import { AppViewModelContext, useAppViewModel } from '../../src'

/**
 * Dummy consumer that uses the ViewModel context
 * Used to validate that useAppViewModel throws or not depending on Provider usage
 */
function ViewModelConsumer() {
  useAppViewModel<unknown>()
  return null
}

describe('AppViewModelContext', () => {
  it('does not throw when useAppViewModel is used inside AppViewModelContext.Provider', () => {
    const vm = {}
  
    const renderSafeUsage = () => {
      render(
        <AppViewModelContext.Provider value={vm}>
          <ViewModelConsumer />
        </AppViewModelContext.Provider>
      )
    }
  
    expect(renderSafeUsage).not.toThrow()
  })

  it('throws clear error when useAppViewModel is called without AppViewModelContext.Provider', () => {
    const errorFn = () => {
      render(<ViewModelConsumer />)
    }
  
    expect(errorFn).toThrow(
      'useAppViewModel must be used within a RootKnockoutProvider.'
    )
  })
})