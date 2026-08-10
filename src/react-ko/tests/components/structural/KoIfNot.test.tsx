import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import ko from 'knockout'
import { RootKnockoutProvider, KnockoutScope, KoIfNot } from '@/index'

describe('KoIfNot', () => {
  it('shows children when observable condition is false', () => {
    const vm = { isHidden: ko.observable(false) }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <KoIfNot condition={vm.isHidden}>
            <p>Not hidden</p>
          </KoIfNot>
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    expect(screen.getByText('Not hidden')).toBeDefined()
  })

  it('hides children when observable condition is true', () => {
    const vm = { isHidden: ko.observable(true) }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <KoIfNot condition={vm.isHidden}>
            <p>Hidden</p>
          </KoIfNot>
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    expect(screen.queryByText('Hidden')).toBeNull()
  })

  it('shows children when computed condition is false', () => {
    const vm = { isHidden: ko.computed(() => false) }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <KoIfNot condition={vm.isHidden}>
            <p>Not hidden</p>
          </KoIfNot>
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    expect(screen.getByText('Not hidden')).toBeDefined()
  })

  it('hides children when computed condition is true', () => {
    const vm = { isHidden: ko.computed(() => true) }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <KoIfNot condition={vm.isHidden}>
            <p>Hidden</p>
          </KoIfNot>
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    expect(screen.queryByText('Hidden')).toBeNull()
  })

  it('responds to computed condition transitions', () => {
    const hidden = ko.observable(false)
    const vm = { isHidden: ko.computed(() => hidden()) }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <KoIfNot condition={vm.isHidden}>
            <p>Computed transition</p>
          </KoIfNot>
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    expect(screen.getByText('Computed transition')).toBeDefined()

    act(() => hidden(true))
    expect(screen.queryByText('Computed transition')).toBeNull()

    act(() => hidden(false))
    expect(screen.getByText('Computed transition')).toBeDefined()
  })

  it('subscribes to a replacement condition source', () => {
    const first = ko.observable(false)
    const second = ko.observable(true)

    function Harness({ condition }: { condition: ko.Observable<boolean> }) {
      return (
        <RootKnockoutProvider viewModel={{}}>
          <KoIfNot condition={condition}>
            <p>Replacement condition</p>
          </KoIfNot>
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness condition={first} />)
    expect(screen.getByText('Replacement condition')).toBeDefined()

    rerender(<Harness condition={second} />)
    expect(screen.queryByText('Replacement condition')).toBeNull()

    act(() => first(true))
    expect(screen.queryByText('Replacement condition')).toBeNull()

    act(() => second(false))
    expect(screen.getByText('Replacement condition')).toBeDefined()
  })

  it('shows children when boolean condition is false', () => {
    const vm = { isHidden: false }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <KoIfNot condition={vm.isHidden}>
            <p>Not hidden</p>
          </KoIfNot>
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    expect(screen.getByText('Not hidden')).toBeDefined()
  })

  it('hides children when boolean condition is true', () => {
    const vm = { isHidden: true }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <KoIfNot condition={vm.isHidden}>
            <p>Hidden</p>
          </KoIfNot>
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    expect(screen.queryByText('Hidden')).toBeNull()
  })

  it('binds children mounted after the condition becomes false', () => {
    const vm = { isHidden: ko.observable(true), label: ko.observable('Late') }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <KoIfNot condition={vm.isHidden}>
            <span data-bind="text: label" />
          </KoIfNot>
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    expect(screen.queryByText('Late')).toBeNull()

    act(() => {
      vm.isHidden(false)
    })

    expect(screen.getByText('Late')).toBeDefined()

    act(() => {
      vm.label('Changed')
    })

    expect(screen.getByText('Changed')).toBeDefined()
  })

  it('unbinds children when the condition becomes true', () => {
    const vm = { isHidden: ko.observable(false), label: ko.observable('Gone') }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <KoIfNot condition={vm.isHidden}>
            <span data-bind="text: label" />
          </KoIfNot>
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    expect(vm.label.getSubscriptionsCount()).toBeGreaterThan(0)

    act(() => {
      vm.isHidden(true)
    })

    expect(screen.queryByText('Gone')).toBeNull()
    expect(vm.label.getSubscriptionsCount()).toBe(0)
  })

  it('binds children to the root view model when there is no enclosing scope', () => {
    const vm = { isHidden: ko.observable(false), label: ko.observable('Root') }

    render(
      <RootKnockoutProvider viewModel={vm}>
        <KoIfNot condition={vm.isHidden}>
          <span data-bind="text: label" />
        </KoIfNot>
      </RootKnockoutProvider>
    )

    expect(screen.getByText('Root')).toBeDefined()
  })
})
