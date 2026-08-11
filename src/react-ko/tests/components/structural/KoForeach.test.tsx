import * as React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import ko from 'knockout'
import { RootKnockoutProvider, KoForeach } from '@/index'

type Row = { name: ko.Observable<string> }

function row(name: string): Row {
  return { name: ko.observable(name) }
}

function StatefulIndex({ index }: { index: number }) {
  const [initialIndex] = React.useState(index)
  return <span>{`${index}:${initialIndex}`}</span>
}

describe('KoForeach', () => {
  it('renders the render prop once per item (observable array)', () => {
    const vm = { items: ko.observableArray(['A', 'B', 'C']) }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KoForeach items={vm.items}>
          {(item) => <span>{item}</span>}
        </KoForeach>
      </RootKnockoutProvider>
    )

    expect(screen.getByText('A')).toBeDefined()
    expect(screen.getByText('B')).toBeDefined()
    expect(screen.getByText('C')).toBeDefined()
  })

  it('renders nothing when the array is empty', () => {
    const vm = { items: ko.observableArray<string>([]) }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KoForeach items={vm.items}>
          {(item) => <span>{item}</span>}
        </KoForeach>
      </RootKnockoutProvider>
    )

    expect(screen.queryByText(/./)).toBeNull()
  })

  it('passes the index to the render prop', () => {
    const vm = { items: ko.observableArray(['A', 'B']) }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KoForeach items={vm.items}>
          {(item, index) => <span>{`${index}:${item}`}</span>}
        </KoForeach>
      </RootKnockoutProvider>
    )

    expect(screen.getByText('0:A')).toBeDefined()
    expect(screen.getByText('1:B')).toBeDefined()
  })

  it('binds data-bind inside a row to the row item', () => {
    const first = row('A')
    const vm = { items: ko.observableArray([first]) }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KoForeach items={vm.items}>
          {() => <span data-bind="text: name" />}
        </KoForeach>
      </RootKnockoutProvider>
    )

    expect(screen.getByText('A')).toBeDefined()

    act(() => {
      first.name('Z')
    })

    expect(screen.getByText('Z')).toBeDefined()
  })

  it('binds rows added after the initial render', () => {
    const vm = { items: ko.observableArray([row('A')]) }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KoForeach items={vm.items}>
          {() => <span data-bind="text: name" />}
        </KoForeach>
      </RootKnockoutProvider>
    )

    act(() => {
      vm.items.push(row('New'))
    })

    expect(screen.getByText('New')).toBeDefined()
  })

  it('removes rows and disposes their bindings', () => {
    const first = row('A')
    const second = row('B')
    const vm = { items: ko.observableArray([first, second]) }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KoForeach items={vm.items}>
          {() => <span data-bind="text: name" />}
        </KoForeach>
      </RootKnockoutProvider>
    )

    expect(first.name.getSubscriptionsCount()).toBeGreaterThan(0)

    act(() => {
      vm.items.remove(first)
    })

    expect(screen.queryByText('A')).toBeNull()
    expect(screen.getByText('B')).toBeDefined()
    expect(first.name.getSubscriptionsCount()).toBe(0)
  })

  it('re-renders when a computed array changes', () => {
    const source = ko.observableArray(['A'])
    const vm = { upper: ko.computed(() => source().map((item) => item.toUpperCase())) }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KoForeach items={vm.upper}>
          {(item) => <span>{item}</span>}
        </KoForeach>
      </RootKnockoutProvider>
    )

    expect(screen.getByText('A')).toBeDefined()

    act(() => {
      source.push('b')
    })

    expect(screen.getByText('B')).toBeDefined()
  })

  it('re-renders when an observable array value is replaced', () => {
    const items = ko.observable<string[]>(['A'])

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KoForeach items={items}>
          {(item) => <span>{item}</span>}
        </KoForeach>
      </RootKnockoutProvider>
    )

    act(() => {
      items(['B', 'C'])
    })

    expect(screen.queryByText('A')).toBeNull()
    expect(screen.getByText('B')).toBeDefined()
    expect(screen.getByText('C')).toBeDefined()
  })

  it.each([null, undefined])(
    'renders nothing when an observable array is updated to %s and recovers',
    (emptyValue) => {
      const items = ko.observableArray(['A'])

      render(
        <RootKnockoutProvider viewModel={{}}>
          <KoForeach items={items}>
            {(item) => <span>{item}</span>}
          </KoForeach>
        </RootKnockoutProvider>
      )

      act(() => {
        items(emptyValue as unknown as string[])
      })

      expect(screen.queryByText('A')).toBeNull()

      act(() => {
        items(['B'])
      })

      expect(screen.getByText('B')).toBeDefined()
    }
  )

  it('renders plain arrays', () => {
    render(
      <RootKnockoutProvider viewModel={{}}>
        <KoForeach items={['A', 'B']}>
          {(item) => <span>{item}</span>}
        </KoForeach>
      </RootKnockoutProvider>
    )

    expect(screen.getByText('A')).toBeDefined()
    expect(screen.getByText('B')).toBeDefined()
  })

  it('re-renders when the plain array prop changes', () => {
    function Harness({ items }: { items: string[] }) {
      return (
        <RootKnockoutProvider viewModel={{}}>
          <KoForeach items={items}>
            {(item) => <span>{item}</span>}
          </KoForeach>
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness items={['A']} />)

    rerender(<Harness items={['B', 'C']} />)

    expect(screen.queryByText('A')).toBeNull()
    expect(screen.getByText('B')).toBeDefined()
    expect(screen.getByText('C')).toBeDefined()
  })

  it('moves its subscription when the items source is replaced', () => {
    const first = ko.observableArray(['A'])
    const second = ko.observableArray(['B'])

    function Harness({ items }: { items: ko.ObservableArray<string> }) {
      return (
        <RootKnockoutProvider viewModel={{}}>
          <KoForeach items={items}>
            {(item) => <span>{item}</span>}
          </KoForeach>
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness items={first} />)
    expect(first.getSubscriptionsCount()).toBe(1)

    rerender(<Harness items={second} />)

    expect(screen.queryByText('A')).toBeNull()
    expect(screen.getByText('B')).toBeDefined()
    expect(first.getSubscriptionsCount()).toBe(0)
    expect(second.getSubscriptionsCount()).toBe(1)

    act(() => {
      first.push('Ignored')
    })
    expect(screen.queryByText('Ignored')).toBeNull()

    act(() => {
      second.push('C')
    })
    expect(screen.getByText('C')).toBeDefined()
  })

  it('keeps row DOM identity across reorders for object items', () => {
    const first = row('A')
    const second = row('B')
    const vm = { items: ko.observableArray([first, second]) }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KoForeach items={vm.items}>
          {() => <span data-bind="text: name" />}
        </KoForeach>
      </RootKnockoutProvider>
    )

    const node = screen.getByText('A')

    act(() => {
      vm.items.reverse()
    })

    expect(screen.getByText('A')).toBe(node)
  })

  it('keeps distinct state for repeated object references after a preceding row is removed', () => {
    const before = row('Before')
    const shared = row('Shared')
    const items = ko.observableArray([before, shared, shared])

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KoForeach items={items}>
          {(_, index) => <StatefulIndex index={index} />}
        </KoForeach>
      </RootKnockoutProvider>
    )

    act(() => {
      items.splice(0, 1)
    })

    expect(screen.getByText('0:1')).toBeDefined()
    expect(screen.getByText('1:2')).toBeDefined()
  })

  it('makes each object item the Knockout $root for its row', () => {
    const appVm = { name: ko.observable('App') }
    const item = row('Row')

    render(
      <RootKnockoutProvider viewModel={appVm}>
        <KoForeach items={[item]}>
          {() => <span data-bind="text: $root.name" />}
        </KoForeach>
      </RootKnockoutProvider>
    )

    expect(screen.getByText('Row')).toBeDefined()
    expect(screen.queryByText('App')).toBeNull()
  })

  it('keys rows with itemKey when provided', () => {
    const vm = { items: ko.observableArray(['A', 'B']) }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KoForeach items={vm.items} itemKey={(item) => item}>
          {(item) => <span>{item}</span>}
        </KoForeach>
      </RootKnockoutProvider>
    )

    const node = screen.getByText('A')

    act(() => {
      vm.items.reverse()
    })

    expect(screen.getByText('A')).toBe(node)
  })

  it('exposes outer items to nested loops through closures', () => {
    const vm = {
      groups: ko.observableArray([
        { name: 'G1', members: ko.observableArray(['x', 'y']) },
        { name: 'G2', members: ko.observableArray(['z']) }
      ])
    }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KoForeach items={vm.groups}>
          {(group) => (
            <KoForeach items={group.members}>
              {(member) => <span>{`${group.name}-${member}`}</span>}
            </KoForeach>
          )}
        </KoForeach>
      </RootKnockoutProvider>
    )

    expect(screen.getByText('G1-x')).toBeDefined()
    expect(screen.getByText('G1-y')).toBeDefined()
    expect(screen.getByText('G2-z')).toBeDefined()
  })

  it('disposes its items subscription on unmount', () => {
    const items = ko.observableArray(['A'])

    const { unmount } = render(
      <RootKnockoutProvider viewModel={{}}>
        <KoForeach items={items}>
          {(item) => <span>{item}</span>}
        </KoForeach>
      </RootKnockoutProvider>
    )

    expect(items.getSubscriptionsCount()).toBe(1)

    unmount()

    expect(items.getSubscriptionsCount()).toBe(0)
  })
})
