import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ko from 'knockout'
import { RootKnockoutProvider, KnockoutScope, KoForeach } from '@/index'

describe('KoForeach', () => {
  it('renders children for each item in the array (observable)', () => {
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

  it('renders nothing when the array is empty (observable)', () => {
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

  it('reactively updates when items are added (observable)', () => {
    const vm = { items: ko.observableArray(['A']) }
  
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
  
    vm.items.push('B')
    expect(screen.findByText('B')).toBeDefined()
  })

  it('renders children for each item in the array (computed)', () => {
    const items = ko.observableArray(['A', 'B', 'C'])
    const vm = {
      items_computed: ko.computed<unknown[]>(() => items())
    }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <KoForeach items={vm.items_computed}>
            <span data-bind="text: $data" />
          </KoForeach>
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    expect(screen.getByText('A')).toBeDefined()
    expect(screen.getByText('B')).toBeDefined()
    expect(screen.getByText('C')).toBeDefined()
  })

  it('renders nothing when the array is empty (computed)', () => {
    const items = ko.observableArray([])
    const vm = {
      items_computed: ko.computed<unknown[]>(() => items())
    }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <KoForeach items={vm.items_computed}>
            <span data-bind="text: $data" />
          </KoForeach>
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    expect(screen.queryByText(/./)).toBeNull()
  })

  it('reactively updates when items are added (computed)', () => {
    const items = ko.observableArray(['A'])
    const vm = {
      items_computed: ko.computed<unknown[]>(() => items())
    }
  
    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <KoForeach items={vm.items_computed}>
            <span data-bind="text: $data" />
          </KoForeach>
        </KnockoutScope>
      </RootKnockoutProvider>
    )
  
    expect(screen.getByText('A')).toBeDefined()
  
    items.push('B')
    expect(screen.findByText('B')).toBeDefined()
  })

  it('renders children for each item in the array (primitive)', () => {
    const vm = { items: ['A', 'B', 'C'] }

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

  it('renders nothing when the array is empty (primitive)', () => {
    const vm = { items: [] }

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
