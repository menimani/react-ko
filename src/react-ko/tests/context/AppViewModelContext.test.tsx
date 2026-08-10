import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { AppViewModelContext, createAppViewModelContext, useAppViewModel } from '@/index'

/**
 * Dummy consumer that uses the ViewModel context
 * Used to validate that useAppViewModel throws or not depending on Provider usage
 */
function ViewModelConsumer() {
  useAppViewModel<unknown>()
  return null
}

function CapturingViewModelConsumer({ onValue }: { onValue: (value: unknown) => void }) {
  onValue(useAppViewModel<unknown>())
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

  it.each([
    ['object', {}],
    ['null', null],
    ['undefined', undefined],
  ])('returns the exact %s ViewModel supplied by the Provider', (_label, vm) => {
    let received: unknown = Symbol('not captured')

    render(
      <AppViewModelContext.Provider value={vm}>
        <CapturingViewModelConsumer onValue={(value) => (received = value)} />
      </AppViewModelContext.Provider>
    )

    expect(received).toBe(vm)
  })

  it('throws clear error when useAppViewModel is called without AppViewModelContext.Provider', () => {
    const errorFn = () => {
      render(<ViewModelConsumer />)
    }
  
    expect(errorFn).toThrow(
      'useAppViewModel must be used within an AppViewModelContext.Provider.'
    )
  })
})

describe('createAppViewModelContext', () => {
  const TypedAppViewModelContext = createAppViewModelContext<{ name: string }>()

  function TypedConsumer({ onValue }: { onValue?: (value: { name: string }) => void }) {
    const value = TypedAppViewModelContext.useAppViewModel()
    onValue?.(value)
    return null
  }

  it('returns the exact ViewModel supplied by its matching Provider', () => {
    const vm = { name: 'typed' }
    let received: { name: string } | undefined

    render(
      <TypedAppViewModelContext.Provider value={vm}>
        <TypedConsumer onValue={(value) => (received = value)} />
      </TypedAppViewModelContext.Provider>
    )

    expect(received).toBe(vm)
  })

  it('throws when used outside its matching Provider', () => {
    expect(() => render(<TypedConsumer />)).toThrow(
      'useAppViewModel must be used within its matching Provider.'
    )
  })
})
