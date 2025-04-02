import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ko from 'knockout'
import { RootKnockoutProvider, KnockoutScope, KoIfNot } from '@/index'

describe('KoIfNot', () => {
  it('renders children when condition is false', () => {
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

  it('does not render children when condition is true', () => {
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
})