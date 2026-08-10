import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { useLayoutEffect } from 'react'
import ko from 'knockout'
import { useKoValue } from '@/index'

function LayoutMutator({ run }: { run: () => void }) {
  useLayoutEffect(() => {
    run()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

function Probe<T>({ source }: { source: ko.Observable<T> | ko.Computed<T> | T }) {
  const value = useKoValue(source)
  return <span data-testid="value">{String(value)}</span>
}

describe('useKoValue', () => {
  it('returns the current value of an observable', () => {
    const name = ko.observable('Hello')

    render(<Probe source={name} />)

    expect(screen.getByTestId('value').textContent).toBe('Hello')
  })

  it('re-renders when the observable changes', () => {
    const name = ko.observable('Hello')

    render(<Probe source={name} />)

    act(() => {
      name('World')
    })

    expect(screen.getByTestId('value').textContent).toBe('World')
  })

  it('re-renders when a computed changes', () => {
    const count = ko.observable(1)
    const doubled = ko.computed(() => count() * 2)

    render(<Probe source={doubled} />)
    expect(screen.getByTestId('value').textContent).toBe('2')

    act(() => {
      count(5)
    })

    expect(screen.getByTestId('value').textContent).toBe('10')
  })

  it('re-renders when an observableArray mutates in place', () => {
    const items = ko.observableArray(['A'])

    render(<Probe source={items} />)
    expect(screen.getByTestId('value').textContent).toBe('A')

    act(() => {
      items.push('B')
    })

    expect(screen.getByTestId('value').textContent).toBe('A,B')
  })

  it('passes plain values through unchanged', () => {
    render(<Probe source={42} />)

    expect(screen.getByTestId('value').textContent).toBe('42')
  })

  it('catches a change fired between render and subscription', () => {
    const name = ko.observable('Hello')

    render(
      <>
        <Probe source={name} />
        <LayoutMutator run={() => name('Changed')} />
      </>
    )

    expect(screen.getByTestId('value').textContent).toBe('Changed')
  })

  it('catches an in-place array change fired between render and subscription', () => {
    const items = ko.observableArray(['A'])

    render(
      <>
        <Probe source={items} />
        <LayoutMutator run={() => items.push('B')} />
      </>
    )

    expect(screen.getByTestId('value').textContent).toBe('A,B')
  })

  it('disposes its subscription on unmount', () => {
    const name = ko.observable('Hello')

    const { unmount } = render(<Probe source={name} />)
    expect(name.getSubscriptionsCount()).toBe(1)

    unmount()

    expect(name.getSubscriptionsCount()).toBe(0)
  })
})
