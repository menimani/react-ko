import { act, render, screen } from '@testing-library/react'
import ko from 'knockout'
import { describe, expect, it } from 'vitest'
import { KoIf, KoIfNot, KnockoutScope, RootKnockoutProvider } from '@/index'

const conditionalComponents: Array<{
  name: string
  Component: typeof KoIf
  visibleCondition: boolean
}> = [
  { name: 'KoIf', Component: KoIf, visibleCondition: true },
  { name: 'KoIfNot', Component: KoIfNot, visibleCondition: false },
]

describe.each(conditionalComponents)('$name shared behavior', ({ Component, visibleCondition }) => {
  const hiddenCondition = !visibleCondition

  it('responds to computed condition transitions', () => {
    const source = ko.observable(visibleCondition)
    const condition = ko.computed(() => source())

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={{ condition }}>
          <Component condition={condition}>
            <p>Computed transition</p>
          </Component>
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    expect(screen.getByText('Computed transition')).toBeDefined()

    act(() => source(hiddenCondition))
    expect(screen.queryByText('Computed transition')).toBeNull()

    act(() => source(visibleCondition))
    expect(screen.getByText('Computed transition')).toBeDefined()
  })

  it('subscribes to a replacement observable condition source', () => {
    const first = ko.observable(visibleCondition)
    const second = ko.observable(hiddenCondition)

    function Harness({ condition }: { condition: ko.Observable<boolean> }) {
      return (
        <RootKnockoutProvider viewModel={{}}>
          <Component condition={condition}>
            <p>Replacement condition</p>
          </Component>
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness condition={first} />)
    expect(screen.getByText('Replacement condition')).toBeDefined()

    rerender(<Harness condition={second} />)
    expect(screen.queryByText('Replacement condition')).toBeNull()

    act(() => first(hiddenCondition))
    expect(screen.queryByText('Replacement condition')).toBeNull()

    act(() => second(visibleCondition))
    expect(screen.getByText('Replacement condition')).toBeDefined()
  })

  it('re-renders when the plain boolean condition prop changes', () => {
    function Harness({ condition }: { condition: boolean }) {
      return (
        <RootKnockoutProvider viewModel={{}}>
          <Component condition={condition}>
            <p>Plain condition</p>
          </Component>
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness condition={hiddenCondition} />)
    expect(screen.queryByText('Plain condition')).toBeNull()

    rerender(<Harness condition={visibleCondition} />)
    expect(screen.getByText('Plain condition')).toBeDefined()

    rerender(<Harness condition={hiddenCondition} />)
    expect(screen.queryByText('Plain condition')).toBeNull()
  })

  it('binds children mounted after the condition becomes visible', () => {
    const condition = ko.observable(hiddenCondition)
    const label = ko.observable('Late')

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={{ condition, label }}>
          <Component condition={condition}>
            <span data-bind="text: label" />
          </Component>
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    expect(screen.queryByText('Late')).toBeNull()

    act(() => condition(visibleCondition))
    expect(screen.getByText('Late')).toBeDefined()

    act(() => label('Changed'))
    expect(screen.getByText('Changed')).toBeDefined()
  })

  it('unbinds children when the condition becomes hidden', () => {
    const condition = ko.observable(visibleCondition)
    const label = ko.observable('Gone')

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={{ condition, label }}>
          <Component condition={condition}>
            <span data-bind="text: label" />
          </Component>
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    expect(label.getSubscriptionsCount()).toBeGreaterThan(0)

    act(() => condition(hiddenCondition))

    expect(screen.queryByText('Gone')).toBeNull()
    expect(label.getSubscriptionsCount()).toBe(0)
  })

  it('binds children to the root view model when there is no enclosing scope', () => {
    const condition = ko.observable(visibleCondition)
    const label = ko.observable('Root')

    render(
      <RootKnockoutProvider viewModel={{ condition, label }}>
        <Component condition={condition}>
          <span data-bind="text: label" />
        </Component>
      </RootKnockoutProvider>
    )

    expect(screen.getByText('Root')).toBeDefined()

    act(() => label('Updated'))
    expect(screen.getByText('Updated')).toBeDefined()
  })

  it('disposes its condition subscription on unmount', () => {
    const condition = ko.observable(visibleCondition)
    const { unmount } = render(
      <RootKnockoutProvider viewModel={{}}>
        <Component condition={condition}>
          <span>Visible</span>
        </Component>
      </RootKnockoutProvider>
    )

    expect(condition.getSubscriptionsCount()).toBe(1)
    unmount()
    expect(condition.getSubscriptionsCount()).toBe(0)
  })
})
