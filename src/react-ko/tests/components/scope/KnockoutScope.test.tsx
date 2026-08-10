import { describe, it, expect, vi } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { Component, StrictMode, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import ko from 'knockout'
import {
  AppViewModelContext,
  RootKnockoutProvider,
  KnockoutScope,
  KoScope,
} from '@/index'

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? <span>Binding failed</span> : this.props.children
  }
}

describe('KnockoutScope', () => {
  it('requires an enclosing app view model provider without leaking subscriptions', () => {
    const vm = { name: ko.observable('Unbound') }

    expect(() =>
      render(
        <KnockoutScope viewModel={vm}>
          <span data-bind="text: name" />
        </KnockoutScope>
      )
    ).toThrow('useAppViewModel must be used within an AppViewModelContext.Provider.')
    expect(vm.name.getSubscriptionsCount()).toBe(0)
  })

  it('binds directly beneath AppViewModelContext.Provider without a root provider', () => {
    const appVm = { name: ko.observable('App') }
    const scopeVm = { name: ko.observable('Scoped') }

    render(
      <AppViewModelContext.Provider value={appVm}>
        <KnockoutScope viewModel={scopeVm}>
          <span data-bind="text: name" />
        </KnockoutScope>
      </AppViewModelContext.Provider>
    )

    expect(screen.getByText('Scoped')).toBeDefined()
    expect(screen.queryByText('App')).toBeNull()

    act(() => {
      scopeVm.name('Updated')
    })

    expect(screen.getByText('Updated')).toBeDefined()
    expect(screen.queryByText('Scoped')).toBeNull()
  })

  it('binds and cleans ordinary React descendants mounted later', async () => {
    const vm = { name: ko.observable('Scoped later') }

    function Harness({ show }: { show: boolean }) {
      return (
        <RootKnockoutProvider viewModel={{}}>
          <KnockoutScope viewModel={vm}>
            {show ? <span data-bind="text: name" /> : null}
          </KnockoutScope>
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness show={false} />)
    expect(vm.name.getSubscriptionsCount()).toBe(0)

    rerender(<Harness show />)
    await waitFor(() => {
      expect(screen.getByText('Scoped later')).toBeDefined()
      expect(vm.name.getSubscriptionsCount()).toBeGreaterThan(0)
    })

    rerender(<Harness show={false} />)
    await waitFor(() => expect(vm.name.getSubscriptionsCount()).toBe(0))
  })

  it('binds a descendant inserted by local state before its layout effects run', () => {
    const vm = { name: ko.observable('Initial') }
    let showInput = () => undefined

    function ChangeInLayout() {
      const input = useRef<HTMLInputElement>(null)

      useLayoutEffect(() => {
        if (input.current !== null) {
          input.current.value = 'Changed in layout'
          input.current.dispatchEvent(new Event('change', { bubbles: true }))
        }
      }, [])

      return <input ref={input} data-bind="value: name" />
    }

    function LocalStateOwner() {
      const [show, setShow] = useState(false)
      showInput = () => setShow(true)
      return show ? <ChangeInLayout /> : null
    }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <LocalStateOwner />
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    act(() => showInput())

    expect(vm.name()).toBe('Changed in layout')
  })

  it('sends a late binding error to a React error boundary with a stable view model', async () => {
    const appVm = {}
    const vm = {}
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    function Harness({ show }: { show: boolean }) {
      return (
        <ErrorBoundary>
          <RootKnockoutProvider viewModel={appVm}>
            <KnockoutScope viewModel={vm}>
              {show ? <span data-bind="text: missing.value" /> : null}
            </KnockoutScope>
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

  it('reapplies a changed data-bind in the nearest scope', async () => {
    const root = {
      first: ko.observable('Root first'),
      second: ko.observable('Root second'),
    }
    const scope = {
      first: ko.observable('Scope first'),
      second: ko.observable('Scope second'),
    }

    function Harness({ binding }: { binding: 'first' | 'second' }) {
      return (
        <RootKnockoutProvider viewModel={root}>
          <KnockoutScope viewModel={scope}>
            <span data-bind={`text: ${binding}`} />
          </KnockoutScope>
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness binding="first" />)
    expect(screen.getByText('Scope first')).toBeDefined()

    rerender(<Harness binding="second" />)

    await waitFor(() => {
      expect(screen.getByText('Scope second')).toBeDefined()
      expect(scope.first.getSubscriptionsCount()).toBe(0)
      expect(scope.second.getSubscriptionsCount()).toBe(1)
    })
    expect(root.second.getSubscriptionsCount()).toBe(0)
  })

  it('updates DOM when observable changes (observable → DOM)', () => {
    const vm = { name: ko.observable('Hello') }

    const { container } = render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <input data-bind="value: name" />
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    const input = container.querySelector('input')!
    expect(input.value).toBe('Hello')

    act(() => {
      vm.name('World')
    })

    expect(input.value).toBe('World')
  })

  it('updates observable via input event when valueUpdate is "input" (DOM → observable)', () => {
    const vm = { name: ko.observable('Hello') }

    const { container } = render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <input data-bind="value: name, valueUpdate: 'input'" />
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    const input = container.querySelector('input')!
    expect(vm.name()).toBe('Hello')

    act(() => {
      input.value = 'World'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })

    expect(vm.name()).toBe('World')
  })

  it('does not update observable via input event without valueUpdate', () => {
    const vm = { name: ko.observable('Hello') }

    const { container } = render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <input data-bind="value: name" />
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    const input = container.querySelector('input')!

    act(() => {
      input.value = 'World'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })

    expect(vm.name()).toBe('Hello')
  })

  it('updates observable via change event (DOM → observable, default KO behavior)', () => {
    const vm = { name: ko.observable('Hello') }

    const { container } = render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <input data-bind="value: name" />
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    const input = container.querySelector('input')!
    expect(vm.name()).toBe('Hello')

    act(() => {
      input.value = 'World'
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })

    expect(vm.name()).toBe('World')
  })

  it('disposes its bindings on unmount', () => {
    const vm = { name: ko.observable('Hello') }

    const { unmount } = render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <input data-bind="value: name" />
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    expect(vm.name.getSubscriptionsCount()).toBeGreaterThan(0)

    unmount()

    expect(vm.name.getSubscriptionsCount()).toBe(0)
  })

  it('disposes bindings created before a later binding throws', () => {
    const vm = { name: ko.observable('Subscribed') }
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    try {
      render(
        <ErrorBoundary>
          <RootKnockoutProvider viewModel={{}}>
            <KnockoutScope viewModel={vm}>
              <span data-bind="text: name" />
              <span data-bind="text: missing.value" />
            </KnockoutScope>
          </RootKnockoutProvider>
        </ErrorBoundary>
      )
    } finally {
      consoleError.mockRestore()
    }

    expect(screen.getByText('Binding failed')).toBeDefined()
    expect(vm.name.getSubscriptionsCount()).toBe(0)
  })

  it('binds once and cleans up correctly under StrictMode', () => {
    const vm = { name: ko.observable('Strict') }

    const { unmount } = render(
      <StrictMode>
        <RootKnockoutProvider viewModel={{}}>
          <KnockoutScope viewModel={vm}>
            <span data-bind="text: name" />
          </KnockoutScope>
        </RootKnockoutProvider>
      </StrictMode>
    )

    expect(screen.getByText('Strict')).toBeDefined()
    expect(vm.name.getSubscriptionsCount()).toBe(1)

    unmount()

    expect(vm.name.getSubscriptionsCount()).toBe(0)
  })

  it('rebinds and disposes the previous bindings when its view model changes', () => {
    const first = { name: ko.observable('First') }
    const second = { name: ko.observable('Second') }

    function Harness({ viewModel }: { viewModel: typeof first }) {
      return (
        <RootKnockoutProvider viewModel={{}}>
          <KnockoutScope viewModel={viewModel}>
            <span data-bind="text: name" />
          </KnockoutScope>
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness viewModel={first} />)
    expect(screen.getByText('First')).toBeDefined()
    expect(first.name.getSubscriptionsCount()).toBeGreaterThan(0)

    rerender(<Harness viewModel={second} />)

    expect(screen.getByText('Second')).toBeDefined()
    expect(first.name.getSubscriptionsCount()).toBe(0)
    expect(second.name.getSubscriptionsCount()).toBeGreaterThan(0)
  })

  it('rebinds a replacement view model before descendant layout effects dispatch change events', () => {
    const first = { name: ko.observable('First') }
    const second = { name: ko.observable('Second') }

    function ChangeInLayout({ value }: { value: string | null }) {
      const input = useRef<HTMLInputElement>(null)

      useLayoutEffect(() => {
        if (value !== null && input.current !== null) {
          input.current.value = value
          input.current.dispatchEvent(new Event('change', { bubbles: true }))
        }
      }, [value])

      return <input ref={input} data-bind="value: name" />
    }

    function Harness({ viewModel, value }: { viewModel: typeof first; value: string | null }) {
      return (
        <RootKnockoutProvider viewModel={{}}>
          <KnockoutScope viewModel={viewModel}>
            <ChangeInLayout value={value} />
          </KnockoutScope>
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness viewModel={first} value={null} />)
    rerender(<Harness viewModel={second} value="Changed in layout" />)

    expect(first.name()).toBe('First')
    expect(second.name()).toBe('Changed in layout')
  })

  it('makes the scoped view model the Knockout $root', () => {
    const appVm = { name: ko.observable('App') }
    const scopeVm = { name: ko.observable('Scope') }

    render(
      <RootKnockoutProvider viewModel={appVm}>
        <KnockoutScope viewModel={scopeVm}>
          <span data-bind="text: $root.name" />
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    expect(screen.getByText('Scope')).toBeDefined()
    expect(screen.queryByText('App')).toBeNull()
  })

  it('rebinds nested scopes when an ancestor scope rebinds', () => {
    const appVm = {}
    const inner = { label: ko.observable('First') }
    const outerA = { title: ko.observable('A') }
    const outerB = { title: ko.observable('B') }

    function Harness({ outer }: { outer: unknown }) {
      return (
        <RootKnockoutProvider viewModel={appVm}>
          <KnockoutScope viewModel={outer}>
            <KnockoutScope viewModel={inner}>
              <span data-bind="text: label" />
            </KnockoutScope>
          </KnockoutScope>
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness outer={outerA} />)
    expect(screen.getByText('First')).toBeDefined()

    rerender(<Harness outer={outerB} />)

    act(() => {
      inner.label('Second')
    })

    expect(screen.getByText('Second')).toBeDefined()
  })
})

describe('KoScope', () => {
  it('is an alias of KnockoutScope', () => {
    expect(KoScope).toBe(KnockoutScope)
  })

  it('surfaces a structural binding rejected at initial mount and unbinds cleanly', () => {
    const vm = { items: ko.observableArray<string>([]) }

    const { unmount } = render(
      <ErrorBoundary>
        <RootKnockoutProvider viewModel={{}}>
          <KnockoutScope viewModel={vm}>
            <div data-bind="foreach: items">
              <span />
            </div>
          </KnockoutScope>
        </RootKnockoutProvider>
      </ErrorBoundary>
    )

    expect(screen.getByText('Binding failed')).toBeDefined()

    unmount()
  })
})
