import { Component, useState, type ReactNode } from 'react'
import { act, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { KnockoutScope, useKoViewModel } from '@/index'

class ErrorBoundary extends Component<
  { children: ReactNode },
  { message: string }
> {
  state = { message: '' }

  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? error.message : String(error) }
  }

  render() {
    return this.state.message === '' ? (
      this.props.children
    ) : (
      <span data-testid="failure">{this.state.message}</span>
    )
  }
}

function ViewModelProbe({ testId = 'view-model' }: { testId?: string }) {
  const viewModel = useKoViewModel<{ label: string }>()
  return <span data-testid={testId}>{viewModel.label}</span>
}

describe('useKoViewModel', () => {
  it('returns the nearest KnockoutScope view model', () => {
    render(
      <KnockoutScope viewModel={{ label: 'outer' }}>
        <ViewModelProbe testId="outer" />
        <KnockoutScope viewModel={{ label: 'inner' }}>
          <ViewModelProbe testId="inner" />
        </KnockoutScope>
      </KnockoutScope>
    )

    expect(screen.getByTestId('outer').textContent).toBe('outer')
    expect(screen.getByTestId('inner').textContent).toBe('inner')
  })

  it('returns the replacement view model in the same render', () => {
    function Harness() {
      const [replacement, setReplacement] = useState(false)
      return (
        <KnockoutScope
          viewModel={{ label: replacement ? 'replacement' : 'initial' }}
        >
          <ViewModelProbe />
          <button type="button" onClick={() => setReplacement(true)}>
            replace
          </button>
        </KnockoutScope>
      )
    }

    render(<Harness />)
    expect(screen.getByTestId('view-model').textContent).toBe('initial')

    act(() => screen.getByRole('button').click())

    expect(screen.getByTestId('view-model').textContent).toBe('replacement')
  })

  it.each([null, undefined])(
    'preserves the %s view model instead of treating it as a missing scope',
    (value) => {
      let received: null | undefined = value === null ? undefined : null

      function NullishProbe() {
        received = useKoViewModel<null | undefined>()
        return null
      }

      render(
        <KnockoutScope viewModel={value}>
          <NullishProbe />
        </KnockoutScope>
      )

      expect(received).toBe(value)
    }
  )

  it('reports a missing KnockoutScope', () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    try {
      render(
        <ErrorBoundary>
          <ViewModelProbe />
        </ErrorBoundary>
      )

      expect(screen.getByTestId('failure').textContent).toBe(
        'react-ko: useKoViewModel must be used within a KnockoutScope.'
      )
    } finally {
      consoleError.mockRestore()
    }
  })
})
