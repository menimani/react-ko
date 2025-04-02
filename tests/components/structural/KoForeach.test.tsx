import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KoForeach } from '@/components/structural/KoForeach'
import { KnockoutScope } from '@/KnockoutScope'
import { RootKnockoutProvider } from '@/RootKnockoutProvider'
import ko from 'knockout'

describe('KoForeach', () => {
  it('renders children for each item in the array', () => {
    const vm = { items: ko.observableArray(['A', 'B', 'C']) }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <KoForeach items={vm.items}>
            <span data-bind="text: $data" />
          </KoForeach>
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    expect(screen.getByText('A')).toBeDefined()
    expect(screen.getByText('B')).toBeDefined()
    expect(screen.getByText('C')).toBeDefined()
  })

  it('renders nothing when the array is empty', () => {
    const vm = { items: ko.observableArray([]) }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <KoForeach items={vm.items}>
            <span data-bind="text: $data" />
          </KoForeach>
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    expect(screen.queryByText(/./)).toBeNull()
  })
})