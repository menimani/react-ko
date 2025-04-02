import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KoIf } from '@/components/structural/KoIf'
import { KnockoutScope } from '@/KnockoutScope'
import ko from 'knockout'
import { RootKnockoutProvider } from '@/RootKnockoutProvider'

describe('KoIf', () => {
  it('renders children when condition is true', () => {
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

  it('does not render children when condition is false', () => {
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
})