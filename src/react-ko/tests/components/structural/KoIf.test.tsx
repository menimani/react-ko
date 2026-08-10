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
})