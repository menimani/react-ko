import { describe, it, expect, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { Component, StrictMode, type ReactNode } from 'react'
import ko from 'knockout'
import { KnockoutScope, RootKnockoutProvider, useAppViewModel } from '@/index'

/**
 * Dummy consumer that uses the ViewModel context
 * Used to validate that useAppViewModel throws or not depending on Provider usage
 */
function ViewModelConsumer() {
  useAppViewModel<unknown>()
  return null
}

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? <span>Binding failed</span> : this.props.children
  }
}

describe('RootKnockoutProvider', () => {
  it('binds direct children to the root view model', () => {
    const vm = { label: ko.observable('Initial') }

    render(
      <RootKnockoutProvider viewModel={vm}>
        <span data-bind="text: label" />
      </RootKnockoutProvider>
    )

    expect(screen.getByText('Initial')).toBeDefined()

    act(() => {
      vm.label('Updated')
    })

    expect(screen.getByText('Updated')).toBeDefined()
  })

  it('rebinds and disposes the previous bindings when its view model changes', () => {
    const first = { label: ko.observable('First') }
    const second = { label: ko.observable('Second') }

    const { rerender } = render(
      <RootKnockoutProvider viewModel={first}>
        <span data-bind="text: label" />
      </RootKnockoutProvider>
    )

    expect(screen.getByText('First')).toBeDefined()
    expect(first.label.getSubscriptionsCount()).toBeGreaterThan(0)

    rerender(
      <RootKnockoutProvider viewModel={second}>
        <span data-bind="text: label" />
      </RootKnockoutProvider>
    )

    expect(screen.getByText('Second')).toBeDefined()
    expect(first.label.getSubscriptionsCount()).toBe(0)
    expect(second.label.getSubscriptionsCount()).toBeGreaterThan(0)
  })

  it('rebinds nested scopes after replacing the root view model', () => {
    const firstRoot = { label: ko.observable('Root A') }
    const secondRoot = { label: ko.observable('Root B') }
    const nested = { label: ko.observable('Nested A') }

    function Harness({ viewModel }: { viewModel: typeof firstRoot }) {
      return (
        <RootKnockoutProvider viewModel={viewModel}>
          <span data-bind="text: label" />
          <KnockoutScope viewModel={nested}>
            <span data-bind="text: label" />
          </KnockoutScope>
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness viewModel={firstRoot} />)
    expect(screen.getByText('Nested A')).toBeDefined()

    rerender(<Harness viewModel={secondRoot} />)

    act(() => {
      nested.label('Nested B')
    })

    expect(screen.getByText('Root B')).toBeDefined()
    expect(screen.getByText('Nested B')).toBeDefined()
    expect(nested.label.getSubscriptionsCount()).toBeGreaterThan(0)
  })

  it('disposes its bindings on unmount', () => {
    const vm = { label: ko.observable('Mounted') }

    const { unmount } = render(
      <RootKnockoutProvider viewModel={vm}>
        <span data-bind="text: label" />
      </RootKnockoutProvider>
    )

    expect(vm.label.getSubscriptionsCount()).toBeGreaterThan(0)

    unmount()

    expect(vm.label.getSubscriptionsCount()).toBe(0)
  })

  it('disposes bindings created before a later binding throws', () => {
    const vm = { label: ko.observable('Subscribed') }
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    try {
      render(
        <ErrorBoundary>
          <RootKnockoutProvider viewModel={vm}>
            <span data-bind="text: label" />
            <span data-bind="text: missing.value" />
          </RootKnockoutProvider>
        </ErrorBoundary>
      )
    } finally {
      consoleError.mockRestore()
    }

    expect(screen.getByText('Binding failed')).toBeDefined()
    expect(vm.label.getSubscriptionsCount()).toBe(0)
  })

  it('binds once and cleans up correctly under StrictMode', () => {
    const vm = { label: ko.observable('Strict') }

    const { unmount } = render(
      <StrictMode>
        <RootKnockoutProvider viewModel={vm}>
          <span data-bind="text: label" />
        </RootKnockoutProvider>
      </StrictMode>
    )

    expect(screen.getByText('Strict')).toBeDefined()
    expect(vm.label.getSubscriptionsCount()).toBe(1)

    unmount()

    expect(vm.label.getSubscriptionsCount()).toBe(0)
  })

  it('does not throw when useAppViewModel is used inside RootKnockoutProvider', () => {
    const vm = {}
  
    const renderSafeUsage = () => {
      render(
        <RootKnockoutProvider viewModel={vm}>
          <ViewModelConsumer />
        </RootKnockoutProvider>
      )
    }
  
    expect(renderSafeUsage).not.toThrow()
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
