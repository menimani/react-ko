import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KoIfNotComment } from '@/components/structural/compat/KoIfNotComment'
import { KnockoutScope } from '@/KnockoutScope'
import ko from 'knockout'
import { RootKnockoutProvider } from '@/RootKnockoutProvider'

describe('KoIfNotComment', () => {
  it('renders children when condition is false', () => {
    const vm = { isHidden: ko.observable(false) }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <KoIfNotComment condition={vm.isHidden}>
            <p>Not hidden</p>
          </KoIfNotComment>
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
          <KoIfNotComment condition={vm.isHidden}>
            <p>Hidden</p>
          </KoIfNotComment>
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    expect(screen.queryByText('Hidden')).toBeNull()
  })
})