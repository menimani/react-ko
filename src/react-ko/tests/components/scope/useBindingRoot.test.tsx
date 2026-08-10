import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Component, type ReactNode } from 'react'
import ko from 'knockout'
import { RootKnockoutProvider, KnockoutScope } from '@/index'

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? <span>Binding failed</span> : this.props.children
  }
}

describe('useBindingRoot', () => {
  it('unmounts cleanly when a rebind fails after the old binding was disposed', () => {
    const vmA = { label: ko.observable('First') }
    const vmB = { label: ko.observable('Second'), items: ko.observableArray<string>([]) }

    function Harness({ vm, bad }: { vm: unknown; bad: boolean }) {
      return (
        <ErrorBoundary>
          <RootKnockoutProvider viewModel={{}}>
            <KnockoutScope viewModel={vm}>
              {bad ? (
                <div data-bind="foreach: items">
                  <span />
                </div>
              ) : (
                <span data-bind="text: label" />
              )}
            </KnockoutScope>
          </RootKnockoutProvider>
        </ErrorBoundary>
      )
    }

    const { rerender, unmount } = render(<Harness vm={vmA} bad={false} />)
    expect(screen.getByText('First')).toBeDefined()

    // The rebind disposes the old binding first, so its failure leaves no
    // active binding behind; unmounting afterwards must not crash on it.
    rerender(<Harness vm={vmB} bad />)
    expect(screen.getByText('Binding failed')).toBeDefined()

    unmount()

    expect(vmA.label.getSubscriptionsCount()).toBe(0)
  })
})
