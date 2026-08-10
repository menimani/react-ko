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

function ObjectProbe({ source }: { source: ko.Observable<{ label: string }> }) {
  const value = useKoValue(source)
  return <span data-testid="value">{value.label}</span>
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

  it('moves its subscription when the source changes', () => {
    const first = ko.observable('First')
    const second = ko.observable('Second')

    const { rerender } = render(<Probe source={first} />)
    expect(first.getSubscriptionsCount()).toBe(1)

    rerender(<Probe source={second} />)

    expect(screen.getByTestId('value').textContent).toBe('Second')
    expect(first.getSubscriptionsCount()).toBe(0)
    expect(second.getSubscriptionsCount()).toBe(1)

    act(() => {
      first('Ignored')
      second('Updated')
    })

    expect(screen.getByTestId('value').textContent).toBe('Updated')
  })

  it('disposes its subscription when the source becomes plain or undefined', () => {
    const observable = ko.observable('Observable')
    let renderCount = 0

    function OptionalProbe({
      source,
    }: {
      source?: ko.Observable<string> | string
    }) {
      renderCount += 1
      const value = useKoValue(source)
      return <span data-testid="value">{value ?? 'none'}</span>
    }

    const { rerender } = render(<OptionalProbe source={observable} />)
    expect(observable.getSubscriptionsCount()).toBe(1)

    rerender(<OptionalProbe source="Plain" />)

    expect(screen.getByTestId('value').textContent).toBe('Plain')
    expect(observable.getSubscriptionsCount()).toBe(0)

    const rendersAfterPlainValue = renderCount
    act(() => {
      observable('Ignored after plain value')
    })
    expect(renderCount).toBe(rendersAfterPlainValue)
    expect(screen.getByTestId('value').textContent).toBe('Plain')

    rerender(<OptionalProbe />)

    expect(screen.getByTestId('value').textContent).toBe('none')
    expect(observable.getSubscriptionsCount()).toBe(0)

    const rendersAfterUndefined = renderCount
    act(() => {
      observable('Ignored after undefined')
    })
    expect(renderCount).toBe(rendersAfterUndefined)
    expect(screen.getByTestId('value').textContent).toBe('none')
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

  it('catches an in-place object change fired between render and subscription', () => {
    const state = ko.observable({ label: 'Before' })

    render(
      <>
        <ObjectProbe source={state} />
        <LayoutMutator
          run={() => {
            state().label = 'After'
            state.valueHasMutated()
          }}
        />
      </>
    )

    expect(screen.getByTestId('value').textContent).toBe('After')
  })

  it('returns undefined for an absent optional source', () => {
    function OptionalProbe({ source }: { source?: ko.Observable<string> }) {
      const value = useKoValue(source)
      return <span data-testid="optional">{value ?? 'none'}</span>
    }

    const { rerender } = render(<OptionalProbe />)
    expect(screen.getByTestId('optional').textContent).toBe('none')

    const present = ko.observable('present')
    rerender(<OptionalProbe source={present} />)
    expect(screen.getByTestId('optional').textContent).toBe('present')
  })

  it('disposes its subscription on unmount', () => {
    const name = ko.observable('Hello')

    const { unmount } = render(<Probe source={name} />)
    expect(name.getSubscriptionsCount()).toBe(1)

    unmount()

    expect(name.getSubscriptionsCount()).toBe(0)
  })
})
