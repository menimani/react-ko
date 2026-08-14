import { describe, it, expect, vi } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import {
  Component,
  StrictMode,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createRoot } from 'react-dom/client'
import ko from 'knockout'
import { KnockoutScope } from '@/index'

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

describe('KnockoutScope', () => {
  it('binds its children and keeps them live', () => {
    const vm = { label: ko.observable('First') }

    render(
      <KnockoutScope viewModel={vm}>
        <span data-testid="value" data-bind="text: label" />
      </KnockoutScope>
    )

    expect(screen.getByTestId('value').textContent).toBe('First')
    act(() => vm.label('Second'))
    expect(screen.getByTestId('value').textContent).toBe('Second')
  })

  it('binds inside a detached DocumentFragment', () => {
    const label = ko.observable('Detached')
    const fragment = document.createDocumentFragment()
    const root = createRoot(fragment)

    try {
      act(() =>
        root.render(
          <KnockoutScope viewModel={{ label }}>
            <span data-bind="text: label" />
          </KnockoutScope>
        )
      )

      expect(fragment.textContent).toBe('Detached')
      act(() => label('Updated'))
      expect(fragment.textContent).toBe('Updated')
    } finally {
      act(() => root.unmount())
    }
  })

  it('retires listeners after replacement and unmount in a document without a window', () => {
    const secondaryDocument = document.implementation.createHTMLDocument('secondary')
    expect(secondaryDocument.defaultView).toBeNull()
    const container = secondaryDocument.createElement('div')
    secondaryDocument.body.appendChild(container)
    const root = createRoot(container)
    const first = vi.fn()
    const second = vi.fn()

    function Scope({ handle }: { handle: () => void }) {
      return (
        <KnockoutScope viewModel={{ handle }}>
          <button data-bind="click: handle" />
        </KnockoutScope>
      )
    }

    act(() => root.render(<Scope handle={first} />))
    const button = container.querySelector('button')!
    button.click()
    expect(first).toHaveBeenCalledOnce()

    act(() => root.render(<Scope handle={second} />))
    button.click()
    expect(first).toHaveBeenCalledOnce()
    expect(second).toHaveBeenCalledOnce()

    act(() => root.unmount())
    expect(button.isConnected).toBe(false)
    button.click()
    expect(first).toHaveBeenCalledOnce()
    expect(second).toHaveBeenCalledOnce()
  })

  it('keeps one live subscription through StrictMode replay and disposes it on unmount', () => {
    const vm = { label: ko.observable('Strict') }

    const { unmount } = render(
      <StrictMode>
        <KnockoutScope viewModel={vm}>
          <span data-testid="strict-value" data-bind="text: label" />
        </KnockoutScope>
      </StrictMode>
    )

    expect(screen.getByTestId('strict-value').textContent).toBe('Strict')
    expect(vm.label.getSubscriptionsCount()).toBe(1)

    unmount()

    expect(vm.label.getSubscriptionsCount()).toBe(0)
  })

  it.each([null, undefined])(
    'disposes and rebinds when its view model is replaced with %s',
    (missingViewModel) => {
      const first = { label: ko.observable('First') }
      const second = { label: ko.observable('Second') }

      function Harness({
        viewModel,
      }: {
        viewModel: typeof first | null | undefined
      }) {
        return (
          <KnockoutScope viewModel={viewModel}>
            <span
              data-testid="value"
              data-bind="text: $data === null ? 'null' : typeof $data === 'undefined' ? 'undefined' : label"
            />
          </KnockoutScope>
        )
      }

      const { rerender } = render(<Harness viewModel={first} />)
      const value = screen.getByTestId('value')
      expect(value.textContent).toBe('First')
      expect(first.label.getSubscriptionsCount()).toBe(1)

      rerender(<Harness viewModel={missingViewModel} />)
      expect(value.textContent).toBe(
        missingViewModel === null ? 'null' : 'undefined'
      )
      expect(first.label.getSubscriptionsCount()).toBe(0)

      act(() => first.label('Changed after disposal'))
      expect(value.textContent).toBe(
        missingViewModel === null ? 'null' : 'undefined'
      )

      rerender(<Harness viewModel={second} />)
      expect(value.textContent).toBe('Second')
      expect(second.label.getSubscriptionsCount()).toBe(1)

      act(() => second.label('Rebound'))
      expect(value.textContent).toBe('Rebound')
    }
  )

  it('sends a binding failure to a React error boundary', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const vm = {
      get label(): string {
        throw new Error('View model read failed')
      },
    }

    try {
      render(
        <ErrorBoundary>
          <KnockoutScope viewModel={vm}>
            <span data-bind="text: label" />
          </KnockoutScope>
        </ErrorBoundary>
      )

      await waitFor(() =>
        expect(screen.getByTestId('failure').textContent).toContain(
          'View model read failed'
        )
      )
    } finally {
      consoleError.mockRestore()
    }
  })

  it('keeps a nested scope bound when the outer view model is replaced', () => {
    const first = { outer: ko.observable('first') }
    const second = { outer: ko.observable('second') }
    const inner = { inner: ko.observable('inner') }

    function Harness() {
      const [replaced, setReplaced] = useState(false)
      return (
        <KnockoutScope viewModel={replaced ? second : first}>
          <span data-testid="outer" data-bind="text: outer" />
          <button type="button" onClick={() => setReplaced(true)}>
            replace
          </button>
          <KnockoutScope viewModel={inner}>
            <span data-testid="inner" data-bind="text: inner" />
          </KnockoutScope>
        </KnockoutScope>
      )
    }

    render(<Harness />)
    expect(screen.getByTestId('outer').textContent).toBe('first')
    expect(screen.getByTestId('inner').textContent).toBe('inner')

    act(() => screen.getByRole('button').click())

    expect(screen.getByTestId('outer').textContent).toBe('second')
    act(() => inner.inner('inner changed'))
    expect(screen.getByTestId('inner').textContent).toBe('inner changed')
  })

  it('validates nested roots before replacing an outer scope', async () => {
    const binding = 'appendOnInitForNestedScopeReplacement'
    const init = vi.fn((element: HTMLElement) => {
      element.appendChild(document.createElement('i'))
    })
    ko.bindingHandlers[binding] = { init }
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    function Harness() {
      const [outer, setOuter] = useState({ version: 1 })
      return (
        <KnockoutScope viewModel={outer}>
          <button type="button" onClick={() => setOuter({ version: 2 })}>
            replace outer scope
          </button>
          <KnockoutScope viewModel={{}}>
            <span data-testid="nested-custom-owner" data-bind={`${binding}: true`} />
          </KnockoutScope>
        </KnockoutScope>
      )
    }

    try {
      render(
        <ErrorBoundary>
          <Harness />
        </ErrorBoundary>
      )
      expect(screen.getByTestId('nested-custom-owner').children).toHaveLength(1)

      act(() => screen.getByRole('button').click())

      await waitFor(() =>
        expect(screen.getByTestId('failure').textContent).toContain(
          `react-ko cannot replace the Knockout "${binding}" binding because its DOM effects cannot be safely retired.`
        )
      )
      expect(init).toHaveBeenCalledOnce()
    } finally {
      delete ko.bindingHandlers[binding]
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

    function Harness() {
      const owner = useRef<HTMLSpanElement>(null)

      useLayoutEffect(() => {
        failRebind = true
        owner.current?.setAttribute('title', 'React layout title')
      }, [])

      return (
        <KnockoutScope viewModel={vm}>
          <span data-bind="text: label" />
          <span ref={owner} data-bind="attr: { title: title }" />
        </KnockoutScope>
      )
    }

    try {
      render(
        <ErrorBoundary>
          <Harness />
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

  it('retires a nested scope when React removes it', () => {
    const outer = { outer: ko.observable('outer') }
    const inner = { inner: ko.observable('inner') }

    function Harness({ showInner }: { showInner: boolean }) {
      return (
        <KnockoutScope viewModel={outer}>
          <span data-testid="outer" data-bind="text: outer" />
          {showInner ? (
            <KnockoutScope viewModel={inner}>
              <span data-bind="text: inner" />
            </KnockoutScope>
          ) : null}
        </KnockoutScope>
      )
    }

    const { rerender } = render(<Harness showInner />)
    expect(inner.inner.getSubscriptionsCount()).toBeGreaterThan(0)

    rerender(<Harness showInner={false} />)

    expect(inner.inner.getSubscriptionsCount()).toBe(0)
    expect(screen.getByTestId('outer').textContent).toBe('outer')
  })

  it('binds a child that arrives after the scope has bound', () => {
    const vm = { label: ko.observable('Late') }

    function Harness({ show }: { show: boolean }) {
      return (
        <KnockoutScope viewModel={vm}>
          <span data-bind="text: label" />
          {show ? <span data-testid="late" data-bind="text: label" /> : null}
        </KnockoutScope>
      )
    }

    const { rerender } = render(<Harness show={false} />)
    rerender(<Harness show />)

    expect(screen.getByTestId('late').textContent).toBe('Late')
    act(() => vm.label('Late changed'))
    expect(screen.getByTestId('late').textContent).toBe('Late changed')
  })

  it('binds a late child before layout in a document without a window', () => {
    const secondaryDocument = document.implementation.createHTMLDocument('secondary')
    const container = secondaryDocument.createElement('div')
    secondaryDocument.body.appendChild(container)
    expect(secondaryDocument.defaultView).toBeNull()

    const root = createRoot(container)
    const layoutText = vi.fn()

    function LateChild() {
      const element = useRef<HTMLSpanElement>(null)
      useLayoutEffect(() => {
        layoutText(element.current?.textContent)
      }, [])
      return <span ref={element} data-bind="text: label" />
    }

    function Harness({ show }: { show: boolean }) {
      return (
        <KnockoutScope viewModel={{ label: 'Bound before layout' }}>
          {show ? <LateChild /> : null}
        </KnockoutScope>
      )
    }

    try {
      act(() => root.render(<Harness show={false} />))
      act(() => root.render(<Harness show />))

      expect(layoutText).toHaveBeenCalledWith('Bound before layout')
      expect(container.textContent).toBe('Bound before layout')
    } finally {
      act(() => root.unmount())
    }
  })
})

describe('KnockoutScope boundary', () => {
  it('retires the boundary binding when its attribute is taken away', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const vm = { label: ko.observable('Bound') }

    try {
      const { container } = render(
        <KnockoutScope viewModel={vm}>
          <span data-testid="value" data-bind="text: label" />
        </KnockoutScope>
      )

      const boundary = container.querySelector('[data-bind="reactKoScopeBoundary: true"]')
      expect(boundary).not.toBeNull()

      // Nothing in the library rewrites this, so the retirement path is only reached
      // when something outside it does. The scope's own binding must survive it.
      act(() => boundary?.setAttribute('data-bind', 'text: label'))
      await waitFor(() =>
        expect(screen.getByTestId('value').textContent).toBe('Bound')
      )

      act(() => vm.label('Still bound'))
      expect(screen.getByTestId('value').textContent).toBe('Still bound')
    } finally {
      consoleError.mockRestore()
    }
  })
})
