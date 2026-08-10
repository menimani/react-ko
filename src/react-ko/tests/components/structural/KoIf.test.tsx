import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import ko from 'knockout'
import { RootKnockoutProvider, KnockoutScope, KoIf } from '@/index'

describe('KoIf', () => {
  it('shows children when observable condition is true', () => {
    const vm = { isVisible: ko.observable(true) }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <KoIf condition={vm.isVisible}>
            <p>Visible</p>
          </KoIf>
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    expect(screen.getByText('Visible')).toBeDefined()
  })

  it('hides children when observable condition is false', () => {
    const vm = { isVisible: ko.observable(false) }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <KoIf condition={vm.isVisible}>
            <p>Hidden</p>
          </KoIf>
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    expect(screen.queryByText('Hidden')).toBeNull()
  })

  it('shows children when computed condition is true', () => {
    const vm = { isVisible: ko.computed(() => true) }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <KoIf condition={vm.isVisible}>
            <p>Visible</p>
          </KoIf>
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    expect(screen.getByText('Visible')).toBeDefined()
  })

  it('hides children when computed condition is false', () => {
    const vm = { isVisible: ko.computed(() => false) }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <KoIf condition={vm.isVisible}>
            <p>Hidden</p>
          </KoIf>
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    expect(screen.queryByText('Hidden')).toBeNull()
  })

  it('responds to computed condition transitions', () => {
    const enabled = ko.observable(true)
    const vm = { isVisible: ko.computed(() => enabled()) }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <KoIf condition={vm.isVisible}>
            <p>Computed transition</p>
          </KoIf>
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    expect(screen.getByText('Computed transition')).toBeDefined()

    act(() => enabled(false))
    expect(screen.queryByText('Computed transition')).toBeNull()

    act(() => enabled(true))
    expect(screen.getByText('Computed transition')).toBeDefined()
  })

  it('subscribes to a replacement condition source', () => {
    const first = ko.observable(true)
    const second = ko.observable(false)

    function Harness({ condition }: { condition: ko.Observable<boolean> }) {
      return (
        <RootKnockoutProvider viewModel={{}}>
          <KoIf condition={condition}>
            <p>Replacement condition</p>
          </KoIf>
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness condition={first} />)
    expect(screen.getByText('Replacement condition')).toBeDefined()

    rerender(<Harness condition={second} />)
    expect(screen.queryByText('Replacement condition')).toBeNull()

    act(() => first(false))
    expect(screen.queryByText('Replacement condition')).toBeNull()

    act(() => second(true))
    expect(screen.getByText('Replacement condition')).toBeDefined()
  })

  it('shows children when boolean condition is true', () => {
    const vm = { isVisible: true }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <KoIf condition={vm.isVisible}>
            <p>Visible</p>
          </KoIf>
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    expect(screen.getByText('Visible')).toBeDefined()
  })

  it('hides children when boolean condition is false', () => {
    const vm = { isVisible: false }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <KoIf condition={vm.isVisible}>
            <p>Hidden</p>
          </KoIf>
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    expect(screen.queryByText('Hidden')).toBeNull()
  })

  it('binds children mounted after the condition becomes true', () => {
    const vm = { isVisible: ko.observable(false), label: ko.observable('Late') }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <KoIf condition={vm.isVisible}>
            <span data-bind="text: label" />
          </KoIf>
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    expect(screen.queryByText('Late')).toBeNull()

    act(() => {
      vm.isVisible(true)
    })

    expect(screen.getByText('Late')).toBeDefined()

    act(() => {
      vm.label('Changed')
    })

    expect(screen.getByText('Changed')).toBeDefined()
  })

  it('unbinds children when the condition becomes false', () => {
    const vm = { isVisible: ko.observable(true), label: ko.observable('Gone') }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <KoIf condition={vm.isVisible}>
            <span data-bind="text: label" />
          </KoIf>
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    expect(vm.label.getSubscriptionsCount()).toBeGreaterThan(0)

    act(() => {
      vm.isVisible(false)
    })

    expect(screen.queryByText('Gone')).toBeNull()
    expect(vm.label.getSubscriptionsCount()).toBe(0)
  })

  it('binds children to the root view model when there is no enclosing scope', () => {
    const vm = { isVisible: ko.observable(true), label: ko.observable('Root') }

    render(
      <RootKnockoutProvider viewModel={vm}>
        <KoIf condition={vm.isVisible}>
          <span data-bind="text: label" />
        </KoIf>
      </RootKnockoutProvider>
    )

    expect(screen.getByText('Root')).toBeDefined()

    act(() => {
      vm.label('Updated')
    })

    expect(screen.getByText('Updated')).toBeDefined()
  })
})
