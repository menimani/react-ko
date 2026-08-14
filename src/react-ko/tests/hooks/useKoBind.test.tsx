import { describe, it, expect, vi } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { Component, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createRoot, hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import ko from 'knockout'
import { useKoBind } from '@/index'

class ErrorBoundary extends Component<{ children: ReactNode }, { message: string }> {
  state = { message: '' }

  static getDerivedStateFromError(error: unknown) {
    return { message: error instanceof Error ? error.message : String(error) }
  }

  render() {
    return this.state.message === '' ? (
      this.props.children
    ) : (
      <span data-testid="failure">{this.state.message}</span>
    )
  }
}

describe('useKoBind', () => {
  it('binds the caller element without adding one of its own', () => {
    const vm = { label: ko.observable('Bound') }

    function Host() {
      const bind = useKoBind(vm)
      return (
        <main data-testid="host" {...bind}>
          <span data-bind="text: label" />
        </main>
      )
    }

    const { container } = render(<Host />)

    expect(screen.getByTestId('host').querySelector('span')?.textContent).toBe('Bound')
    // One element in, one element out: the host is the caller's own <main>.
    expect(container.querySelectorAll('*').length).toBe(2)
    expect(screen.getByTestId('host').tagName).toBe('MAIN')
  })

  it('keeps the binding live when the observable changes', () => {
    const label = ko.observable('First')

    function Host() {
      const bind = useKoBind({ label })
      return (
        <div {...bind}>
          <span data-testid="value" data-bind="text: label" />
        </div>
      )
    }

    render(<Host />)
    act(() => {
      label('Second')
    })

    expect(screen.getByTestId('value').textContent).toBe('Second')
  })

  it('rebinds against a replacement view model', () => {
    function Host() {
      const [vm, setVm] = useState({ label: 'First view model' })
      const bind = useKoBind(vm)
      return (
        <div {...bind}>
          <button type="button" onClick={() => setVm({ label: 'Second view model' })}>
            replace
          </button>
          <span data-testid="value" data-bind="text: label" />
        </div>
      )
    }

    render(<Host />)
    expect(screen.getByTestId('value').textContent).toBe('First view model')

    act(() => {
      screen.getByRole('button').click()
    })

    expect(screen.getByTestId('value').textContent).toBe('Second view model')
  })

  it('retires the binding when the element unmounts while the hook stays mounted', () => {
    const label = ko.observable('Present')
    const vm = { label }

    function Host({ show }: { show: boolean }) {
      const bind = useKoBind(vm)
      return show ? (
        <div {...bind}>
          <span data-testid="value" data-bind="text: label" />
        </div>
      ) : (
        <p data-testid="empty">gone</p>
      )
    }

    const { rerender } = render(<Host show />)
    expect(screen.getByTestId('value').textContent).toBe('Present')
    expect(ko.dataFor(screen.getByTestId('value'))).toBe(vm)

    rerender(<Host show={false} />)
    expect(screen.getByTestId('empty')).toBeDefined()

    // The subscription is gone with the element: a notification after the removal
    // reaches nothing, and a later mount binds again from scratch.
    act(() => {
      label('Changed while unmounted')
    })

    rerender(<Host show />)
    expect(screen.getByTestId('value').textContent).toBe('Changed while unmounted')
  })

  it('binds nothing while the view model is nullish, and binds once it arrives', () => {
    function Host({ viewModel }: { viewModel: { label: string } | null }) {
      const bind = useKoBind(viewModel)
      return viewModel === null ? (
        <p data-testid="empty">nothing selected</p>
      ) : (
        <article {...bind}>
          <span data-testid="value" data-bind="text: label" />
        </article>
      )
    }

    const { rerender } = render(<Host viewModel={null} />)
    expect(screen.getByTestId('empty')).toBeDefined()

    rerender(<Host viewModel={{ label: 'Selected' }} />)
    expect(screen.getByTestId('value').textContent).toBe('Selected')
  })

  it.each([null, undefined])(
    'disposes and resumes binding when a mounted host receives %s',
    (missingViewModel) => {
      const firstLabel = ko.observable('First')
      const first = { label: firstLabel }
      const second = { label: ko.observable('Second') }

      function Host({
        viewModel,
      }: {
        viewModel: typeof first | null | undefined
      }) {
        const bind = useKoBind(viewModel)
        return (
          <div {...bind}>
            <span data-testid="value" data-bind="text: label" />
          </div>
        )
      }

      const { rerender } = render(<Host viewModel={first} />)
      const value = screen.getByTestId('value')
      expect(value.textContent).toBe('First')
      expect(ko.dataFor(value)).toBe(first)

      rerender(<Host viewModel={missingViewModel} />)
      expect(ko.dataFor(value)).toBeUndefined()

      act(() => {
        firstLabel('Changed while disabled')
      })
      expect(value.textContent).toBe('First')

      rerender(<Host viewModel={second} />)
      expect(value.textContent).toBe('Second')
      expect(ko.dataFor(value)).toBe(second)
    }
  )

  it('reports props spread onto more than one element', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    function Host() {
      const bind = useKoBind({ label: 'Shared' })
      return (
        <div>
          <span {...bind} data-bind="text: label" />
          <span {...bind} data-bind="text: label" />
        </div>
      )
    }

    try {
      render(
        <ErrorBoundary>
          <Host />
        </ErrorBoundary>
      )

      await waitFor(() =>
        expect(screen.getByTestId('failure').textContent).toContain(
          'spread onto more than one element'
        )
      )
    } finally {
      consoleError.mockRestore()
    }
  })

  it('sends a binding failure to a React error boundary', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const vm = {
      get label(): string {
        throw new Error('View model read failed')
      },
    }

    function Host() {
      const bind = useKoBind(vm)
      return (
        <div {...bind}>
          <span data-bind="text: label" />
        </div>
      )
    }

    try {
      render(
        <ErrorBoundary>
          <Host />
        </ErrorBoundary>
      )

      // Knockout wraps a failing binding with the expression it was evaluating.
      await waitFor(() =>
        expect(screen.getByTestId('failure').textContent).toContain(
          'View model read failed'
        )
      )
    } finally {
      consoleError.mockRestore()
    }
  })

  it('sends a rebind failure that arrives after the layout phase to an error boundary', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    let failRebind = false
    const vm = {
      label: ko.observable('Subscribed'),
      get title(): string {
        if (failRebind) throw new Error('Post-layout binding failed')
        return 'Knockout title'
      },
    }

    // Writing to Knockout-owned DOM from a layout effect makes the root refresh its
    // descendants once the layout phase is over. That pass runs outside any React
    // commit, so its failure reaches the hook through the error callback.
    function Host() {
      const bind = useKoBind(vm)
      const owner = useRef<HTMLSpanElement>(null)

      useLayoutEffect(() => {
        failRebind = true
        owner.current?.setAttribute('title', 'React layout title')
      }, [])

      return (
        <div {...bind}>
          <span data-bind="text: label" />
          <span ref={owner} data-bind="attr: { title: title }" />
        </div>
      )
    }

    try {
      render(
        <ErrorBoundary>
          <Host />
        </ErrorBoundary>
      )

      await waitFor(() =>
        expect(screen.getByTestId('failure').textContent).toContain(
          'Post-layout binding failed'
        )
      )
    } finally {
      failRebind = false
      consoleError.mockRestore()
    }
  })

  it('binds inside a shadow root before descendant layout effects', () => {
    const handleClick = vi.fn()
    const shadowHost = document.createElement('div')
    const shadowRoot = shadowHost.attachShadow({ mode: 'open' })
    document.body.appendChild(shadowHost)
    const root = createRoot(shadowRoot)

    function ClickOnMount() {
      const button = useRef<HTMLButtonElement>(null)

      useLayoutEffect(() => {
        button.current?.click()
      }, [])

      return <button ref={button} data-bind="click: handleClick" />
    }

    function Host() {
      const bind = useKoBind({ handleClick })
      return (
        <div {...bind}>
          <ClickOnMount />
        </div>
      )
    }

    try {
      act(() => root.render(<Host />))
      expect(handleClick).toHaveBeenCalledOnce()
    } finally {
      act(() => root.unmount())
      shadowHost.remove()
    }
  })

  it('rejects a host inside a closed shadow root before binding too late', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const handleClick = vi.fn()
    const shadowHost = document.createElement('div')
    const shadowRoot = shadowHost.attachShadow({ mode: 'closed' })
    document.body.appendChild(shadowHost)
    const root = createRoot(shadowRoot)

    function ClickOnMount() {
      const button = useRef<HTMLButtonElement>(null)

      useLayoutEffect(() => {
        button.current?.click()
      }, [])

      return <button ref={button} data-bind="click: handleClick" />
    }

    function Host() {
      const bind = useKoBind({ handleClick })
      return (
        <div {...bind}>
          <ClickOnMount />
        </div>
      )
    }

    try {
      await act(async () =>
        root.render(
          <ErrorBoundary>
            <Host />
          </ErrorBoundary>
        )
      )

      expect(handleClick).not.toHaveBeenCalled()
      await waitFor(() =>
        expect(shadowRoot.querySelector('[data-testid="failure"]')?.textContent).toBe(
          'react-ko: useKoBind cannot bind a host inside a closed ShadowRoot before descendant layout effects run. Use KnockoutScope inside the shadow root instead.'
        )
      )
    } finally {
      act(() => root.unmount())
      shadowHost.remove()
      consoleError.mockRestore()
    }
  })

  it('rejects a host rendered into a detached DocumentFragment', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const fragment = document.createDocumentFragment()
    const root = createRoot(fragment)

    function Host() {
      const bind = useKoBind({ label: 'Detached' })
      return (
        <div {...bind}>
          <span data-bind="text: label" />
        </div>
      )
    }

    try {
      await act(async () =>
        root.render(
          <ErrorBoundary>
            <Host />
          </ErrorBoundary>
        )
      )

      await waitFor(() =>
        expect(fragment.querySelector('[data-testid="failure"]')?.textContent).toBe(
          'react-ko: useKoBind cannot bind a detached host before descendant layout effects run. Use KnockoutScope inside the detached tree instead.'
        )
      )
    } finally {
      act(() => root.unmount())
      consoleError.mockRestore()
    }
  })

  it('renders the binding-root attribute on the server without binding', () => {
    function Host() {
      const bind = useKoBind({ label: 'Server' })
      return (
        <div {...bind}>
          <span data-bind="text: label" />
        </div>
      )
    }

    const html = renderToString(<Host />)

    expect(html).toMatch(/data-react-ko-scope="[^"]+"/)
    // Server rendering never runs a ref, so the child keeps the markup it was given.
    expect(html).toContain('<span data-bind="text: label"></span>')
  })

  it('hydrates independent roots with the same generated id', async () => {
    const firstLabel = ko.observable('First')
    const secondLabel = ko.observable('Second')

    function Host({ label }: { label: ko.Observable<string> }) {
      const bind = useKoBind({ label })
      return (
        <div {...bind}>
          <span data-bind="text: label" />
        </div>
      )
    }

    const firstTree = <Host label={firstLabel} />
    const secondTree = <Host label={secondLabel} />
    const firstContainer = document.createElement('div')
    const secondContainer = document.createElement('div')
    firstContainer.innerHTML = renderToString(firstTree)
    secondContainer.innerHTML = renderToString(secondTree)
    expect(firstContainer.firstElementChild?.getAttribute('data-react-ko-scope')).toBe(
      secondContainer.firstElementChild?.getAttribute('data-react-ko-scope')
    )
    document.body.append(firstContainer, secondContainer)
    let firstRoot: Root | undefined
    let secondRoot: Root | undefined

    try {
      await act(async () => {
        firstRoot = hydrateRoot(firstContainer, firstTree)
        secondRoot = hydrateRoot(secondContainer, secondTree)
      })

      expect(firstContainer.textContent).toBe('First')
      expect(secondContainer.textContent).toBe('Second')

      act(() => {
        firstLabel('First update')
      })

      expect(firstContainer.textContent).toBe('First update')
      expect(secondContainer.textContent).toBe('Second')

      act(() => {
        secondLabel('Second update')
      })

      expect(firstContainer.textContent).toBe('First update')
      expect(secondContainer.textContent).toBe('Second update')
    } finally {
      if (firstRoot !== undefined) act(() => firstRoot?.unmount())
      if (secondRoot !== undefined) act(() => secondRoot?.unmount())
      firstContainer.remove()
      secondContainer.remove()
    }
  })

  it('hydrates independent roots with the same generated id in reverse order', async () => {
    const firstLabel = ko.observable('First')
    const secondLabel = ko.observable('Second')

    function Host({ label }: { label: ko.Observable<string> }) {
      const bind = useKoBind({ label })
      return (
        <div {...bind}>
          <span data-bind="text: label" />
        </div>
      )
    }

    const firstTree = <Host label={firstLabel} />
    const secondTree = <Host label={secondLabel} />
    const firstContainer = document.createElement('div')
    const secondContainer = document.createElement('div')
    firstContainer.innerHTML = renderToString(firstTree)
    secondContainer.innerHTML = renderToString(secondTree)
    expect(firstContainer.firstElementChild?.getAttribute('data-react-ko-scope')).toBe(
      secondContainer.firstElementChild?.getAttribute('data-react-ko-scope')
    )
    document.body.append(firstContainer, secondContainer)
    let firstRoot: Root | undefined
    let secondRoot: Root | undefined

    try {
      await act(async () => {
        secondRoot = hydrateRoot(secondContainer, secondTree)
      })

      expect(firstContainer.textContent).toBe('')
      expect(secondContainer.textContent).toBe('Second')

      await act(async () => {
        firstRoot = hydrateRoot(firstContainer, firstTree)
      })

      act(() => {
        firstLabel('First update')
        secondLabel('Second update')
      })

      expect(firstContainer.textContent).toBe('First update')
      expect(secondContainer.textContent).toBe('Second update')
    } finally {
      if (firstRoot !== undefined) act(() => firstRoot?.unmount())
      if (secondRoot !== undefined) act(() => secondRoot?.unmount())
      firstContainer.remove()
      secondContainer.remove()
    }
  })
})
