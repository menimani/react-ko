import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { AppViewModelContext, createAppViewModelContext, useAppViewModel } from '@/index'

function CapturingViewModelConsumer({ onValue }: { onValue: (value: unknown) => void }) {
  onValue(useAppViewModel<unknown>())
  return null
}

describe('AppViewModelContext', () => {
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
      render(<CapturingViewModelConsumer onValue={() => {}} />)
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

  it('throws when used within a Provider from a separate factory call', () => {
    const OtherAppViewModelContext = createAppViewModelContext<{ name: string }>()

    expect(() =>
      render(
        <OtherAppViewModelContext.Provider value={{ name: 'other' }}>
          <TypedConsumer />
        </OtherAppViewModelContext.Provider>
      )
    ).toThrow('useAppViewModel must be used within its matching Provider.')
  })
})
