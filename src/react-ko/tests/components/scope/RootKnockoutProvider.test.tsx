import { describe, it, expect, vi } from 'vitest'
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react'
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

  it('binds ordinary React descendants mounted after the initial pass', async () => {
    const vm = { label: ko.observable('Mounted later') }

    function Harness({ show }: { show: boolean }) {
      return (
        <RootKnockoutProvider viewModel={vm}>
          {show ? <span data-bind="text: label" /> : null}
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness show={false} />)
    expect(vm.label.getSubscriptionsCount()).toBe(0)

    rerender(<Harness show />)

    await waitFor(() => {
      expect(screen.getByText('Mounted later')).toBeDefined()
      expect(vm.label.getSubscriptionsCount()).toBeGreaterThan(0)
    })

    act(() => {
      vm.label('Still bound')
    })
    expect(screen.getByText('Still bound')).toBeDefined()
  })

  it('preserves a let descendant context for children mounted later', async () => {
    const vm = { label: ko.observable('Late alias') }

    function Harness({ show }: { show: boolean }) {
      return (
        <RootKnockoutProvider viewModel={vm}>
          <div data-bind="let: { alias: label }">
            {show ? <span data-bind="text: alias" /> : null}
          </div>
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness show={false} />)
    rerender(<Harness show />)

    await waitFor(() => expect(screen.getByText('Late alias')).toBeDefined())

    act(() => {
      vm.label('Updated alias')
    })
    expect(screen.getByText('Updated alias')).toBeDefined()
  })

  it('sends a late binding error to a React error boundary with a stable view model', async () => {
    const vm = {}
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    function Harness({ show }: { show: boolean }) {
      return (
        <ErrorBoundary>
          <RootKnockoutProvider viewModel={vm}>
            {show ? <span data-bind="text: missing.value" /> : null}
          </RootKnockoutProvider>
        </ErrorBoundary>
      )
    }

    try {
      const { rerender } = render(<Harness show={false} />)
      rerender(<Harness show />)

      await waitFor(() => expect(screen.getByText('Binding failed')).toBeDefined())
    } finally {
      consoleError.mockRestore()
    }
  })

  it('disposes a late descendant when React removes it', async () => {
    const vm = { label: ko.observable('Temporary') }

    function Harness({ show }: { show: boolean }) {
      return (
        <RootKnockoutProvider viewModel={vm}>
          {show ? <span data-bind="text: label" /> : null}
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness show={false} />)
    rerender(<Harness show />)
    await waitFor(() => expect(vm.label.getSubscriptionsCount()).toBeGreaterThan(0))

    rerender(<Harness show={false} />)
    await waitFor(() => expect(vm.label.getSubscriptionsCount()).toBe(0))
  })

  it('disposes and reapplies bindings when React changes data-bind', async () => {
    const vm = {
      first: ko.observable('First'),
      second: ko.observable('Second'),
    }

    function Harness({ binding }: { binding: 'first' | 'second' }) {
      return (
        <RootKnockoutProvider viewModel={vm}>
          <span data-bind={`text: ${binding}`} />
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness binding="first" />)
    expect(screen.getByText('First')).toBeDefined()
    expect(vm.first.getSubscriptionsCount()).toBe(1)

    rerender(<Harness binding="second" />)

    await waitFor(() => {
      expect(screen.getByText('Second')).toBeDefined()
      expect(vm.first.getSubscriptionsCount()).toBe(0)
      expect(vm.second.getSubscriptionsCount()).toBe(1)
    })

    rerender(<Harness binding="second" />)
    expect(vm.second.getSubscriptionsCount()).toBe(1)
  })

  it('preserves a let descendant context when data-bind changes', async () => {
    const vm = {
      first: ko.observable('First alias'),
      second: ko.observable('Second alias'),
    }

    function Harness({ binding }: { binding: 'firstAlias' | 'secondAlias' }) {
      return (
        <RootKnockoutProvider viewModel={vm}>
          <div data-bind="let: { firstAlias: first, secondAlias: second }">
            <span data-bind={`text: ${binding}`} />
          </div>
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness binding="firstAlias" />)
    expect(screen.getByText('First alias')).toBeDefined()

    rerender(<Harness binding="secondAlias" />)

    await waitFor(() => {
      expect(screen.getByText('Second alias')).toBeDefined()
      expect(vm.first.getSubscriptionsCount()).toBe(0)
      expect(vm.second.getSubscriptionsCount()).toBe(1)
    })
  })

  it('rejects React children added while a content binding remains active', async () => {
    const vm = { label: ko.observable('Knockout text') }
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    function Harness({ show }: { show: boolean }) {
      return (
        <ErrorBoundary>
          <RootKnockoutProvider viewModel={vm}>
            <div data-bind="text: label">{show ? <button>React child</button> : null}</div>
          </RootKnockoutProvider>
        </ErrorBoundary>
      )
    }

    try {
      const { rerender } = render(<Harness show={false} />)
      rerender(<Harness show />)

      await waitFor(() => expect(screen.getByText('Binding failed')).toBeDefined())
      expect(vm.label.getSubscriptionsCount()).toBe(0)
    } finally {
      consoleError.mockRestore()
    }
  })

  it.each([
    ['text', 'text: text'],
    ['html', 'html: markup'],
    ['options', 'options: choices'],
  ] as const)('removes content left by a retired %s binding', async (kind, source) => {
    const vm = {
      text: 'Knockout text',
      markup: '<strong>Knockout HTML</strong>',
      choices: ['First', 'Second'],
    }

    function Harness({ bound }: { bound: boolean }) {
      return (
        <RootKnockoutProvider viewModel={vm}>
          {kind === 'options' ? (
            <select data-testid="content-owner" data-bind={bound ? source : undefined} />
          ) : (
            <div data-testid="content-owner" data-bind={bound ? source : undefined} />
          )}
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness bound />)
    const element = screen.getByTestId('content-owner')
    await waitFor(() => expect(element.childNodes.length).toBeGreaterThan(0))

    rerender(<Harness bound={false} />)

    await waitFor(() => expect(element.childNodes).toHaveLength(0))
  })

  it('removes content left by a retired component binding', async () => {
    const componentName = 'react-ko-retired-component-test'
    const vm = {}
    ko.components.register(componentName, {
      template: '<strong>Knockout component</strong>',
    })

    function Harness({ bound }: { bound: boolean }) {
      return (
        <RootKnockoutProvider viewModel={vm}>
          <div
            data-testid="component-owner"
            data-bind={bound ? `component: '${componentName}'` : undefined}
          />
        </RootKnockoutProvider>
      )
    }

    try {
      const { rerender } = render(<Harness bound />)
      const element = screen.getByTestId('component-owner')
      await waitFor(() => expect(element.textContent).toBe('Knockout component'))

      rerender(<Harness bound={false} />)

      await waitFor(() => expect(element.childNodes).toHaveLength(0))
    } finally {
      ko.components.unregister(componentName)
    }
  })

  it('removes retired Knockout content when data-bind is replaced', async () => {
    const vm = { label: 'Knockout text', title: 'Current title' }

    function Harness({ contentBinding }: { contentBinding: boolean }) {
      return (
        <RootKnockoutProvider viewModel={vm}>
          <span
            data-testid="replaced-binding"
            data-bind={contentBinding ? 'text: label' : 'attr: { title: title }'}
          />
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness contentBinding />)
    const element = screen.getByTestId('replaced-binding')
    expect(element.textContent).toBe('Knockout text')

    rerender(<Harness contentBinding={false} />)

    await waitFor(() => {
      expect(element.childNodes).toHaveLength(0)
      expect(element.title).toBe('Current title')
    })
  })

  it('preserves React children added while a content binding is retired', async () => {
    const vm = { label: 'Retired Knockout text' }
    const handleClick = vi.fn()

    function Harness({ bound, childLabel }: { bound: boolean; childLabel: string }) {
      return (
        <RootKnockoutProvider viewModel={vm}>
          <span data-testid="react-child-owner" data-bind={bound ? 'text: label' : undefined}>
            {bound ? null : <button onClick={handleClick}>{childLabel}</button>}
          </span>
        </RootKnockoutProvider>
      )
    }

    const { rerender, unmount } = render(<Harness bound childLabel="First React child" />)
    const element = screen.getByTestId('react-child-owner')
    expect(element.textContent).toBe('Retired Knockout text')

    rerender(<Harness bound={false} childLabel="First React child" />)

    await waitFor(() => expect(element.textContent).toBe('First React child'))
    const button = screen.getByRole('button')
    fireEvent.click(button)
    expect(handleClick).toHaveBeenCalledOnce()

    rerender(<Harness bound={false} childLabel="Updated React child" />)
    expect(screen.getByRole('button')).toBe(button)
    expect(button.textContent).toBe('Updated React child')
    expect(() => unmount()).not.toThrow()
  })

  it('rebinds a changed ancestor and restores nested scopes in their own context', async () => {
    const root = {
      first: ko.observable('Root first'),
      second: ko.observable('Root second'),
    }
    const nested = { second: ko.observable('Nested second') }

    function Harness({ binding }: { binding: 'first' | 'second' }) {
      return (
        <RootKnockoutProvider viewModel={root}>
          <section data-bind={`attr: { title: ${binding} }`}>
            <KnockoutScope viewModel={nested}>
              <span data-bind="text: second" />
            </KnockoutScope>
          </section>
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness binding="first" />)
    expect(screen.getByText('Nested second')).toBeDefined()

    rerender(<Harness binding="second" />)

    await waitFor(() => {
      expect(screen.getByText('Nested second')).toBeDefined()
      expect(root.first.getSubscriptionsCount()).toBe(0)
      expect(root.second.getSubscriptionsCount()).toBe(1)
      expect(nested.second.getSubscriptionsCount()).toBe(1)
    })
  })

  it('preserves the view model of a nested scope mounted later', async () => {
    const root = { label: ko.observable('Root') }
    const nested = { label: ko.observable('Nested') }

    function Harness({ show }: { show: boolean }) {
      return (
        <RootKnockoutProvider viewModel={root}>
          {show ? (
            <KnockoutScope viewModel={nested}>
              <span data-bind="text: label" />
            </KnockoutScope>
          ) : null}
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness show={false} />)
    rerender(<Harness show />)

    await waitFor(() => expect(screen.getByText('Nested')).toBeDefined())
    expect(screen.queryByText('Root')).toBeNull()
    expect(root.label.getSubscriptionsCount()).toBe(0)
    expect(nested.label.getSubscriptionsCount()).toBeGreaterThan(0)
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

  it('creates an independent binding boundary when nested under another root', () => {
    const outer = { label: ko.observable('Outer') }
    const inner = { label: ko.observable('Inner') }

    const { unmount } = render(
      <RootKnockoutProvider viewModel={outer}>
        <span data-bind="text: label" />
        <RootKnockoutProvider viewModel={inner}>
          <span data-bind="text: label" />
        </RootKnockoutProvider>
      </RootKnockoutProvider>
    )

    expect(screen.getByText('Outer')).toBeDefined()
    expect(screen.getByText('Inner')).toBeDefined()
    expect(outer.label.getSubscriptionsCount()).toBeGreaterThan(0)
    expect(inner.label.getSubscriptionsCount()).toBeGreaterThan(0)

    unmount()

    expect(outer.label.getSubscriptionsCount()).toBe(0)
    expect(inner.label.getSubscriptionsCount()).toBe(0)
  })

  it('creates an independent binding boundary when nested under a scope', () => {
    const scope = { label: ko.observable('Scope') }
    const inner = { label: ko.observable('Inner root') }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={scope}>
          <span data-bind="text: label" />
          <RootKnockoutProvider viewModel={inner}>
            <span data-bind="text: label" />
          </RootKnockoutProvider>
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    expect(screen.getByText('Scope')).toBeDefined()
    expect(screen.getByText('Inner root')).toBeDefined()
  })

  it('rebinds a nested root after its enclosing scope is rebound', () => {
    const firstScope = { label: ko.observable('Scope A') }
    const secondScope = { label: ko.observable('Scope B') }
    const inner = { label: ko.observable('Inner A') }

    function Harness({ scope }: { scope: typeof firstScope }) {
      return (
        <RootKnockoutProvider viewModel={{}}>
          <KnockoutScope viewModel={scope}>
            <RootKnockoutProvider viewModel={inner}>
              <span data-bind="text: label" />
            </RootKnockoutProvider>
          </KnockoutScope>
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness scope={firstScope} />)
    expect(screen.getByText('Inner A')).toBeDefined()

    rerender(<Harness scope={secondScope} />)

    act(() => {
      inner.label('Inner B')
    })

    expect(screen.getByText('Inner B')).toBeDefined()
    expect(inner.label.getSubscriptionsCount()).toBeGreaterThan(0)
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
