import * as React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import ko from 'knockout'
import { KoWith, RootKnockoutProvider } from '@/index'

type Selection = { label: ko.Observable<string> }

function selection(label: string): Selection {
  return { label: ko.observable(label) }
}

describe('KoWith', () => {
  it('renders an observable value through its render prop and binds to it', () => {
    const selected = selection('First')
    const value = ko.observable<Selection | null>(selected)

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KoWith value={value}>
          {(item) => (
            <p>
              <span>{item === selected ? 'Selected: ' : ''}</span>
              <span data-bind="text: label" />
            </p>
          )}
        </KoWith>
      </RootKnockoutProvider>
    )

    expect(screen.getByText('Selected:')).toBeDefined()
    expect(screen.getByText('First')).toBeDefined()

    act(() => {
      selected.label('Updated')
    })

    expect(screen.getByText('Updated')).toBeDefined()
  })

  it('unmounts for null and binds a fresh scope when the value returns', () => {
    const first = selection('First')
    const second = selection('Second')
    const value = ko.observable<Selection | null>(first)

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KoWith value={value}>{() => <span data-bind="text: label" />}</KoWith>
      </RootKnockoutProvider>
    )

    expect(first.label.getSubscriptionsCount()).toBeGreaterThan(0)

    act(() => {
      value(null)
    })

    expect(screen.queryByText('First')).toBeNull()
    expect(first.label.getSubscriptionsCount()).toBe(0)

    act(() => {
      value(second)
    })

    expect(screen.getByText('Second')).toBeDefined()
    expect(second.label.getSubscriptionsCount()).toBeGreaterThan(0)
  })

  it('lets React unmount and remount component children across null', () => {
    const value = ko.observable<Selection | null>(selection('Selected'))

    function StatefulChild() {
      const [clicks, setClicks] = React.useState(0)
      return <button onClick={() => setClicks((count) => count + 1)}>{clicks}</button>
    }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KoWith value={value}>{() => <StatefulChild />}</KoWith>
      </RootKnockoutProvider>
    )

    act(() => {
      screen.getByRole('button').click()
    })
    expect(screen.getByRole('button').textContent).toBe('1')

    act(() => {
      value(null)
    })
    expect(screen.queryByRole('button')).toBeNull()

    act(() => {
      value(selection('Returned'))
    })
    expect(screen.getByRole('button').textContent).toBe('0')
  })

  it('rebinds when one present value is replaced by another', () => {
    const first = selection('First')
    const second = selection('Second')
    const value = ko.observable<Selection | null>(first)

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KoWith value={value}>{() => <span data-bind="text: label" />}</KoWith>
      </RootKnockoutProvider>
    )

    act(() => {
      value(second)
    })

    expect(screen.queryByText('First')).toBeNull()
    expect(screen.getByText('Second')).toBeDefined()
    expect(first.label.getSubscriptionsCount()).toBe(0)
    expect(second.label.getSubscriptionsCount()).toBeGreaterThan(0)
  })

  it('updates when a computed value changes', () => {
    const enabled = ko.observable(false)
    const item = selection('Computed')
    const value = ko.computed(() => enabled() ? item : undefined)

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KoWith value={value}>{() => <span data-bind="text: label" />}</KoWith>
      </RootKnockoutProvider>
    )

    expect(screen.queryByText('Computed')).toBeNull()

    act(() => {
      enabled(true)
    })

    expect(screen.getByText('Computed')).toBeDefined()
  })

  it.each([
    ['zero', 0],
    ['false', false],
    ['empty string', ''],
  ])('treats a plain %s as a present value', (_label, value) => {
    render(
      <RootKnockoutProvider viewModel={{}}>
        <KoWith value={value}>{(current) => <span data-testid="value">{String(current)}</span>}</KoWith>
      </RootKnockoutProvider>
    )

    expect(screen.getByTestId('value').textContent).toBe(String(value))
  })

  it.each([null, undefined])('renders nothing for a plain %s value', (value) => {
    render(
      <RootKnockoutProvider viewModel={{}}>
        <KoWith value={value}>{() => <span>Hidden</span>}</KoWith>
      </RootKnockoutProvider>
    )

    expect(screen.queryByText('Hidden')).toBeNull()
  })

  it('re-renders when the plain value prop changes', () => {
    function Harness({ value }: { value: string | null }) {
      return (
        <RootKnockoutProvider viewModel={{}}>
          <KoWith value={value}>{(current) => <span>{current}</span>}</KoWith>
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness value="First" />)
    expect(screen.getByText('First')).toBeDefined()

    rerender(<Harness value={null} />)
    expect(screen.queryByText('First')).toBeNull()

    rerender(<Harness value="Second" />)
    expect(screen.getByText('Second')).toBeDefined()
  })

  it('moves its subscription when the value source is replaced', () => {
    const first = ko.observable<Selection | null>(selection('First'))
    const second = ko.observable<Selection | null>(selection('Second'))

    function Harness({ value }: { value: ko.Observable<Selection | null> }) {
      return (
        <RootKnockoutProvider viewModel={{}}>
          <KoWith value={value}>{() => <span data-bind="text: label" />}</KoWith>
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness value={first} />)
    expect(first.getSubscriptionsCount()).toBe(1)

    rerender(<Harness value={second} />)

    expect(screen.queryByText('First')).toBeNull()
    expect(screen.getByText('Second')).toBeDefined()
    expect(first.getSubscriptionsCount()).toBe(0)
    expect(second.getSubscriptionsCount()).toBe(1)

    act(() => {
      first(null)
    })
    expect(screen.getByText('Second')).toBeDefined()

    act(() => {
      second(selection('Third'))
    })
    expect(screen.queryByText('Second')).toBeNull()
    expect(screen.getByText('Third')).toBeDefined()
  })

  it('disposes its value subscription on unmount', () => {
    const value = ko.observable<Selection | null>(selection('Selected'))
    const { unmount } = render(
      <RootKnockoutProvider viewModel={{}}>
        <KoWith value={value}>{() => <span />}</KoWith>
      </RootKnockoutProvider>
    )

    expect(value.getSubscriptionsCount()).toBe(1)
    unmount()
    expect(value.getSubscriptionsCount()).toBe(0)
  })
})
