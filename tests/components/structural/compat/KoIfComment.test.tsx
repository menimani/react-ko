import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KoIfComment } from '@/components/structural/compat/KoIfComment'
import { KnockoutScope } from '@/KnockoutScope'
import ko from 'knockout'
import { RootKnockoutProvider } from '@/RootKnockoutProvider'

describe('KoIfComment', () => {
  it('renders children when condition is true', () => {
    const vm = { isVisible: ko.observable(true) }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <KoIfComment condition={vm.isVisible}>
            <p>Visible</p>
          </KoIfComment>
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    expect(screen.getByText('Visible')).toBeDefined()
  })

  it('does not render children when condition is false', () => {
    const vm = { isVisible: ko.observable(false) }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <KoIfComment condition={vm.isVisible}>
            <p>Hidden</p>
          </KoIfComment>
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    expect(screen.queryByText('Hidden')).toBeNull()
  })
})