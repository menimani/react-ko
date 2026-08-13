import * as React from 'react'
import { act, render, screen, waitFor } from '@testing-library/react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import ko from 'knockout'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  KoForeach,
  KoIf,
  KoIfNot,
  KoWith,
  RootKnockoutProvider,
} from '@/index'

type Row = {
  id: string
  label: ko.Observable<string>
}

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? <span>Binding failed</span> : this.props.children
  }
}

function row(id: string): Row {
  return { id, label: ko.observable(id) }
}

function OptionList({ items }: { items: ko.ObservableArray<Row> }) {
  return (
    <RootKnockoutProvider viewModel={{}}>
      <select>
        <KoForeach items={items} itemKey={(item) => item.id}>
          {(item, _index, bind) => (
            <option {...bind} data-id={item.id} data-bind="text: label" />
          )}
        </KoForeach>
      </select>
    </RootKnockoutProvider>
  )
}

const hydratedRoots: Root[] = []

afterEach(() => {
  for (const root of hydratedRoots.splice(0)) {
    act(() => root.unmount())
  }
  document.body.replaceChildren()
})

describe('structural element binding mode', () => {
  it('renders only options under select on the server and reuses them during hydration', async () => {
    const items = ko.observableArray([row('A'), row('B')])
    const container = document.createElement('div')
    container.innerHTML = renderToString(<OptionList items={items} />)
    document.body.appendChild(container)

    const select = container.querySelector('select')
    const serverOptions = Array.from(select?.children ?? [])
    expect(serverOptions.map((element) => element.tagName)).toEqual([
      'OPTION',
      'OPTION',
    ])
    expect(
      Array.from(select?.childNodes ?? []).every(
        (node) =>
          node.nodeType === Node.ELEMENT_NODE && node.nodeName === 'OPTION'
      )
    ).toBe(true)

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    let root: Root | undefined
    try {
      await act(async () => {
        root = hydrateRoot(container, <OptionList items={items} />)
      })
      expect(consoleError).not.toHaveBeenCalled()
    } finally {
      consoleError.mockRestore()
    }
    if (root === undefined) throw new Error('Hydration did not create a root')
    hydratedRoots.push(root)

    const hydratedOptions = Array.from(container.querySelectorAll('option'))
    expect(hydratedOptions).toEqual(serverOptions)
    expect(hydratedOptions.map((option) => option.textContent)).toEqual(['A', 'B'])
  })

  it('adds, removes, reorders, and reinserts rows without taking ownership from React', () => {
    const first = row('A')
    const second = row('B')
    const third = row('C')
    const items = ko.observableArray([first, second])
    const { container } = render(<OptionList items={items} />)

    const firstNode = container.querySelector('[data-id="A"]')
    const secondNode = container.querySelector('[data-id="B"]')

    act(() => items.push(third))
    act(() => items.reverse())

    expect(
      Array.from(
        container.querySelectorAll('option'),
        (option) => option.dataset.id
      )
    ).toEqual(['C', 'B', 'A'])
    expect(container.querySelector('[data-id="A"]')).toBe(firstNode)
    expect(container.querySelector('[data-id="B"]')).toBe(secondNode)

    act(() => items.remove(first))
    expect(first.label.getSubscriptionsCount()).toBe(0)
    expect(firstNode?.isConnected).toBe(false)

    act(() => items.splice(1, 0, first))
    const reinsertedNode = container.querySelector('[data-id="A"]')
    expect(reinsertedNode).not.toBe(firstNode)
    expect(
      Array.from(
        container.querySelectorAll('option'),
        (option) => option.dataset.id
      )
    ).toEqual(['C', 'A', 'B'])

    act(() => first.label('A2'))
    expect(reinsertedNode?.textContent).toBe('A2')
  })

  it('binds the row element and its descendants directly for restricted table markup', () => {
    const items = ko.observableArray([row('A')])
    const { container } = render(
      <RootKnockoutProvider viewModel={{}}>
        <table>
          <tbody>
            <KoForeach items={items}>
              {(_item, _index, bind) => (
                <tr {...bind} data-bind="attr: { 'data-label': label }">
                  <td data-bind="text: label" />
                </tr>
              )}
            </KoForeach>
          </tbody>
        </table>
      </RootKnockoutProvider>
    )

    const rowElement = container.querySelector('tr')
    expect(rowElement?.parentElement?.tagName).toBe('TBODY')
    expect(rowElement?.dataset.label).toBe('A')
    expect(rowElement?.querySelector('td')?.textContent).toBe('A')

    act(() => items()[0].label('B'))
    expect(rowElement?.dataset.label).toBe('B')
    expect(rowElement?.querySelector('td')?.textContent).toBe('B')
  })

  it('supports conditional and value scopes without inserting hosts', () => {
    const visible = ko.observable(false)
    const hidden = ko.observable(true)
    const selected = ko.observable<Row | null>(null)
    const vm = { visible, hidden, selected, label: ko.observable('if') }
    const { container } = render(
      <RootKnockoutProvider viewModel={vm}>
        <select>
          <KoIf condition={visible} bindingMode="element">
            <option data-kind="if" data-bind="text: label" />
          </KoIf>
          <KoIfNot condition={hidden} bindingMode="element">
            <option data-kind="ifnot" data-bind="text: label" />
          </KoIfNot>
          <KoWith value={selected} bindingMode="element">
            {(item) => <option data-kind="with" data-bind="text: label" />}
          </KoWith>
        </select>
      </RootKnockoutProvider>
    )

    expect(container.querySelectorAll('option')).toHaveLength(0)
    act(() => {
      visible(true)
      hidden(false)
      selected(row('with'))
    })

    expect(
      Array.from(
        container.querySelectorAll('option'),
        (option) => option.textContent
      )
    ).toEqual(['if', 'if', 'with'])
  })

  it('disposes every element binding when its enclosing scope unmounts', () => {
    const rows = [row('A'), row('B'), row('C')]
    const items = ko.observableArray(rows)
    const { unmount } = render(<OptionList items={items} />)

    for (const item of rows) {
      expect(item.label.getSubscriptionsCount()).toBeGreaterThan(0)
    }

    unmount()

    for (const item of rows) {
      expect(item.label.getSubscriptionsCount()).toBe(0)
    }
  })

  it('disposes a row binding before descendant layout cleanup', () => {
    const item = row('A')
    const items = ko.observableArray([item])
    let subscriptionsDuringCleanup = -1

    function CleanupProbe() {
      React.useLayoutEffect(
        () => () => {
          subscriptionsDuringCleanup = item.label.getSubscriptionsCount()
        },
        []
      )
      return null
    }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <select>
          <KoForeach items={items}>
            {(_item, _index, bind) => (
              <option {...bind} value="A" data-bind="attr: { label: label }">
                <CleanupProbe />
              </option>
            )}
          </KoForeach>
        </select>
      </RootKnockoutProvider>
    )

    act(() => items.remove(item))
    expect(subscriptionsDuringCleanup).toBe(0)
  })

  it('preserves the child ref lifecycle', () => {
    const cleanup = vi.fn()
    const ref = vi.fn((node: HTMLOptionElement | null) => {
      if (node === null) {
        cleanup()
        return
      }
      return cleanup
    })
    const items = ko.observableArray([row('A')])
    const { unmount } = render(
      <RootKnockoutProvider viewModel={{}}>
        <select>
          <KoForeach items={items}>
            {() => <option ref={ref} />}
          </KoForeach>
        </select>
      </RootKnockoutProvider>
    )

    expect(ref).toHaveBeenCalledWith(expect.any(HTMLOptionElement))
    unmount()
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('sends late element-scope binding errors to a React error boundary', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    const setAttribute = Element.prototype.setAttribute

    function Harness() {
      return (
        <ErrorBoundary>
          <RootKnockoutProvider viewModel={{}}>
            <KoIf condition bindingMode="element">
              <div data-testid="element-scope" />
            </KoIf>
          </RootKnockoutProvider>
        </ErrorBoundary>
      )
    }

    try {
      render(<Harness />)
      setAttribute.call(
        screen.getByTestId('element-scope'),
        'data-bind',
        'text: missing.value'
      )
      await waitFor(() => expect(screen.getByText('Binding failed')).toBeDefined())
    } finally {
      consoleError.mockRestore()
    }
  })

  it('rejects a component child in element mode', () => {
    function RowComponent() {
      return <option />
    }

    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)
    try {
      expect(() =>
        render(
          <RootKnockoutProvider viewModel={{}}>
            <select>
              <KoIf condition bindingMode="element">
                <RowComponent />
              </KoIf>
            </select>
          </RootKnockoutProvider>
        )
      ).toThrow(/requires one intrinsic HTML element/)
    } finally {
      consoleError.mockRestore()
    }
  })

  it.each(['svg', 'math'] as const)(
    'rejects the foreign-content root <%s> in element mode',
    (host) => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined)
      try {
        expect(() =>
          render(
            <RootKnockoutProvider viewModel={{}}>
              <KoIf condition bindingMode="element">
                {React.createElement(host) as never}
              </KoIf>
            </RootKnockoutProvider>
          )
        ).toThrow(/requires one intrinsic HTML element/)
      } finally {
        consoleError.mockRestore()
      }
    }
  )
})
