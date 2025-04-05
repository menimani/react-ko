import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
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
})