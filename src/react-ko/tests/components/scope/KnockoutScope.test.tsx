import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import ko from 'knockout'
import { RootKnockoutProvider, KnockoutScope, KoScope } from '@/index'

describe('KnockoutScope', () => {
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
})
