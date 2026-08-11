import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import ko from 'knockout'
import { KoIfNot, KnockoutScope, RootKnockoutProvider } from '@/index'

describe('KoIfNot truth table', () => {
  it.each([
    ['observable', ko.observable(false)],
    ['computed', ko.computed(() => false)],
    ['boolean', false],
  ])('shows children when the %s condition is false', (_type, condition) => {
    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={{ condition }}>
          <KoIfNot condition={condition}>
            <p>Not hidden</p>
          </KoIfNot>
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    expect(screen.getByText('Not hidden')).toBeDefined()
  })

  it.each([
    ['observable', ko.observable(true)],
    ['computed', ko.computed(() => true)],
    ['boolean', true],
  ])('hides children when the %s condition is true', (_type, condition) => {
    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={{ condition }}>
          <KoIfNot condition={condition}>
            <p>Hidden</p>
          </KoIfNot>
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    expect(screen.queryByText('Hidden')).toBeNull()
  })
})
