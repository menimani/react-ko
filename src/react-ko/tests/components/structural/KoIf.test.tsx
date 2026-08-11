import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import ko from 'knockout'
import { KoIf, KnockoutScope, RootKnockoutProvider } from '@/index'

describe('KoIf truth table', () => {
  it.each([
    ['observable', ko.observable(true)],
    ['computed', ko.computed(() => true)],
    ['boolean', true],
  ])('shows children when the %s condition is true', (_type, condition) => {
    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={{ condition }}>
          <KoIf condition={condition}>
            <p>Visible</p>
          </KoIf>
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    expect(screen.getByText('Visible')).toBeDefined()
  })

  it.each([
    ['observable', ko.observable(false)],
    ['computed', ko.computed(() => false)],
    ['boolean', false],
  ])('hides children when the %s condition is false', (_type, condition) => {
    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={{ condition }}>
          <KoIf condition={condition}>
            <p>Hidden</p>
          </KoIf>
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    expect(screen.queryByText('Hidden')).toBeNull()
  })
})
