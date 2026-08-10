import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import ko from 'knockout'
import { RootKnockoutProvider, KnockoutScope, KoIf, KoForeach, useKoValue } from '@/index'

// Knockout's deferred-updates mode batches every notification into a
// microtask, so nothing the library relies on may assume synchronous
// delivery. The file runs in its own worker, so flipping the global
// option cannot leak into other suites.
beforeAll(() => {
  ko.options.deferUpdates = true
})

afterAll(() => {
  ko.options.deferUpdates = false
})

function Probe({ source }: { source: ko.Observable<string> }) {
  const value = useKoValue(source)
  return <span data-testid="value">{value}</span>
}

describe('with ko.options.deferUpdates enabled', () => {
  it('useKoValue re-renders after the deferred notification arrives', async () => {
    const name = ko.observable('Before')
    render(<Probe source={name} />)

    act(() => {
      name('After')
    })

    await waitFor(() => expect(screen.getByTestId('value').textContent).toBe('After'))
  })

  it('data-bind output updates after the deferred notification arrives', async () => {
    const vm = { label: ko.observable('Bound before') }
    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <span data-bind="text: label" />
        </KnockoutScope>
      </RootKnockoutProvider>
    )
    expect(screen.getByText('Bound before')).toBeDefined()

    act(() => {
      vm.label('Bound after')
    })

    await waitFor(() => expect(screen.getByText('Bound after')).toBeDefined())
  })

  it('KoIf toggles children on a deferred condition change', async () => {
    const visible = ko.observable(false)
    render(
      <RootKnockoutProvider viewModel={{}}>
        <KoIf condition={visible}>
          <p>Deferred visible</p>
        </KoIf>
      </RootKnockoutProvider>
    )
    expect(screen.queryByText('Deferred visible')).toBeNull()

    act(() => {
      visible(true)
    })
    await waitFor(() => expect(screen.getByText('Deferred visible')).toBeDefined())

    act(() => {
      visible(false)
    })
    await waitFor(() => expect(screen.queryByText('Deferred visible')).toBeNull())
  })

  it('KoForeach reflects deferred array changes', async () => {
    const items = ko.observableArray(['A'])
    render(
      <RootKnockoutProvider viewModel={{}}>
        <KoForeach items={items}>{(item) => <span>{item}</span>}</KoForeach>
      </RootKnockoutProvider>
    )
    expect(screen.getByText('A')).toBeDefined()

    act(() => {
      items.push('B')
    })
    await waitFor(() => expect(screen.getByText('B')).toBeDefined())

    act(() => {
      items.remove('A')
    })
    await waitFor(() => expect(screen.queryByText('A')).toBeNull())
  })
})
