import { describe, it, expect, vi } from 'vitest'
import { render, screen, act, fireEvent, waitFor } from '@testing-library/react'
import { Component, StrictMode, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import ko from 'knockout'
import { KnockoutScope, RootKnockoutProvider, useAppViewModel } from '@/index'

/**
 * Dummy consumer that uses the ViewModel context
 * Used to validate that useAppViewModel throws or not depending on Provider usage
 */
function ViewModelConsumer() {
  useAppViewModel<unknown>()
  return null
}

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? <span>Binding failed</span> : this.props.children
  }
}

describe('RootKnockoutProvider', () => {
  it('binds direct children to the root view model', () => {
    const vm = { label: ko.observable('Initial') }

    render(
      <RootKnockoutProvider viewModel={vm}>
        <span data-bind="text: label" />
      </RootKnockoutProvider>
    )

    expect(screen.getByText('Initial')).toBeDefined()

    act(() => {
      vm.label('Updated')
    })

    expect(screen.getByText('Updated')).toBeDefined()
  })

  it('binds ordinary React descendants mounted after the initial pass', async () => {
    const vm = { label: ko.observable('Mounted later') }

    function Harness({ show }: { show: boolean }) {
      return (
        <RootKnockoutProvider viewModel={vm}>
          {show ? <span data-bind="text: label" /> : null}
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness show={false} />)
    expect(vm.label.getSubscriptionsCount()).toBe(0)

    rerender(<Harness show />)

    await waitFor(() => {
      expect(screen.getByText('Mounted later')).toBeDefined()
      expect(vm.label.getSubscriptionsCount()).toBeGreaterThan(0)
    })

    act(() => {
      vm.label('Still bound')
    })
    expect(screen.getByText('Still bound')).toBeDefined()
  })

  it('binds a descendant inserted by local state before its layout effects run', () => {
    const vm = { name: ko.observable('Initial') }
    let showInput = () => undefined

    function ChangeInLayout() {
      const input = useRef<HTMLInputElement>(null)

      useLayoutEffect(() => {
        if (input.current !== null) {
          input.current.value = 'Changed in layout'
          input.current.dispatchEvent(new Event('change', { bubbles: true }))
        }
      }, [])

      return <input ref={input} data-bind="value: name" />
    }

    function LocalStateOwner() {
      const [show, setShow] = useState(false)
      showInput = () => setShow(true)
      return show ? <ChangeInLayout /> : null
    }

    render(
      <RootKnockoutProvider viewModel={vm}>
        <LocalStateOwner />
      </RootKnockoutProvider>
    )

    act(() => showInput())

    expect(vm.name()).toBe('Changed in layout')
  })

  it('preserves a let descendant context for children mounted later', async () => {
    const vm = { label: ko.observable('Late alias') }

    function Harness({ show }: { show: boolean }) {
      return (
        <RootKnockoutProvider viewModel={vm}>
          <div data-bind="let: { alias: label }">
            {show ? <span data-bind="text: alias" /> : null}
          </div>
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness show={false} />)
    rerender(<Harness show />)

    await waitFor(() => expect(screen.getByText('Late alias')).toBeDefined())

    act(() => {
      vm.label('Updated alias')
    })
    expect(screen.getByText('Updated alias')).toBeDefined()
  })

  it('sends a late binding error to a React error boundary with a stable view model', async () => {
    const vm = {}
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    function Harness({ show }: { show: boolean }) {
      return (
        <ErrorBoundary>
          <RootKnockoutProvider viewModel={vm}>
            {show ? <span data-bind="text: missing.value" /> : null}
          </RootKnockoutProvider>
        </ErrorBoundary>
      )
    }

    try {
      const { rerender } = render(<Harness show={false} />)
      rerender(<Harness show />)

      await waitFor(() => expect(screen.getByText('Binding failed')).toBeDefined())
    } finally {
      consoleError.mockRestore()
    }
  })

  it('disposes a late descendant when React removes it', async () => {
    const vm = { label: ko.observable('Temporary') }

    function Harness({ show }: { show: boolean }) {
      return (
        <RootKnockoutProvider viewModel={vm}>
          {show ? <span data-bind="text: label" /> : null}
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness show={false} />)
    rerender(<Harness show />)
    await waitFor(() => expect(vm.label.getSubscriptionsCount()).toBeGreaterThan(0))

    rerender(<Harness show={false} />)
    await waitFor(() => expect(vm.label.getSubscriptionsCount()).toBe(0))
  })

  it('disposes and reapplies bindings when React changes data-bind', async () => {
    const vm = {
      first: ko.observable('First'),
      second: ko.observable('Second'),
    }

    function Harness({ binding }: { binding: 'first' | 'second' }) {
      return (
        <RootKnockoutProvider viewModel={vm}>
          <span data-bind={`text: ${binding}`} />
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness binding="first" />)
    expect(screen.getByText('First')).toBeDefined()
    expect(vm.first.getSubscriptionsCount()).toBe(1)

    rerender(<Harness binding="second" />)

    await waitFor(() => {
      expect(screen.getByText('Second')).toBeDefined()
      expect(vm.first.getSubscriptionsCount()).toBe(0)
      expect(vm.second.getSubscriptionsCount()).toBe(1)
    })

    rerender(<Harness binding="second" />)
    expect(vm.second.getSubscriptionsCount()).toBe(1)
  })

  it('removes DOM effects owned by retired bindings before applying replacements', () => {
    const vm = {
      first: ko.observable(true),
      second: ko.observable(true),
      color: ko.observable('red'),
      background: ko.observable('blue'),
      title: ko.observable('Old title'),
      label: ko.observable('Next label'),
      disabled: ko.observable(true),
      name: ko.observable('Next value'),
    }

    function Harness({ next }: { next: boolean }) {
      return (
        <RootKnockoutProvider viewModel={vm}>
          <input
            className="react-owned"
            data-testid="changed-dom-binding"
            data-bind={
              next
                ? "css: { next: second }, style: { backgroundColor: background }, attr: { 'aria-label': label }, value: name"
                : 'css: { old: first }, style: { color: color }, attr: { title: title }, disable: disabled'
            }
          />
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness next={false} />)
    const element = screen.getByTestId('changed-dom-binding') as HTMLInputElement
    expect(element.className).toBe('react-owned old')
    expect(element.style.color).toBe('red')
    expect(element.title).toBe('Old title')
    expect(element.disabled).toBe(true)

    rerender(<Harness next />)

    expect(element.className).toBe('react-owned next')
    expect(element.style.color).toBe('')
    expect(element.style.backgroundColor).toBe('blue')
    expect(element.title).toBe('')
    expect(element.getAttribute('aria-label')).toBe('Next label')
    expect(element.disabled).toBe(false)
    expect(element.value).toBe('Next value')
    expect(vm.first.getSubscriptionsCount()).toBe(0)
    expect(vm.second.getSubscriptionsCount()).toBe(1)
  })

  it('preserves Knockout DOM ownership when React updates bound attributes', () => {
    const vm = {
      oldClass: ko.observable(true),
      nextClass: ko.observable(true),
      color: ko.observable('red'),
      title: ko.observable('Knockout title'),
      value: ko.observable('Knockout value'),
    }

    function Harness({ next }: { next: boolean }) {
      return (
        <RootKnockoutProvider viewModel={vm}>
          <input
            readOnly
            className={next ? 'react-next' : 'react-old'}
            style={{ backgroundColor: next ? 'black' : 'white' }}
            title={next ? 'React next title' : 'React old title'}
            value={next ? 'React next value' : 'React old value'}
            data-testid="react-knockout-ownership"
            data-bind={
              next
                ? 'css: { next: nextClass }, style: { color: color }, attr: { title: title }, value: value'
                : 'css: { old: oldClass }, style: { color: color }, attr: { title: title }, value: value'
            }
          />
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness next={false} />)
    const element = screen.getByTestId('react-knockout-ownership') as HTMLInputElement
    expect(element.className).toBe('react-old old')
    expect(element.style.cssText).toContain('background-color: white')
    expect(element.style.color).toBe('red')
    expect(element.title).toBe('Knockout title')
    expect(element.value).toBe('Knockout value')

    rerender(<Harness next />)

    expect(element.className).toBe('react-next next')
    expect(element.style.cssText).toContain('background-color: black')
    expect(element.style.color).toBe('red')
    expect(element.title).toBe('Knockout title')
    expect(element.value).toBe('Knockout value')
  })

  it('reapplies an unchanged binding after React updates its owned values', async () => {
    const vm = {
      active: ko.observable(true),
      color: ko.observable('red'),
      title: ko.observable('Knockout title'),
      value: ko.observable('Knockout value'),
    }
    const binding =
      'css: { active: active }, style: { color: color }, attr: { title: title }, value: value'

    function Harness({ next }: { next: boolean | null }) {
      return (
        <RootKnockoutProvider viewModel={vm}>
          <input
            readOnly
            className={next === null ? undefined : next ? 'react-next' : 'react-old'}
            style={
              next === null ? undefined : { backgroundColor: next ? 'black' : 'white' }
            }
            title={next === null ? undefined : next ? 'React next title' : 'React old title'}
            value={next ? 'React next value' : 'React old value'}
            data-testid="unchanged-binding-ownership"
            data-bind={binding}
          />
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness next={false} />)
    const element = screen.getByTestId('unchanged-binding-ownership') as HTMLInputElement

    rerender(<Harness next />)

    await waitFor(() => {
      expect(element.className).toBe('react-next active')
      expect(element.style.cssText).toContain('background-color: black')
      expect(element.style.color).toBe('red')
      expect(element.title).toBe('Knockout title')
      expect(element.value).toBe('Knockout value')
    })

    rerender(<Harness next={null} />)

    await waitFor(() => {
      expect(element.className).toBe('active')
      expect(element.style.backgroundColor).toBe('')
      expect(element.style.color).toBe('red')
      expect(element.title).toBe('Knockout title')
      expect(element.value).toBe('Knockout value')
    })
  })

  it('reapplies form-property bindings after React updates their properties', async () => {
    const vm = {
      checked: ko.observable(true),
      enabled: ko.observable(true),
    }

    function Harness({ next }: { next: boolean }) {
      return (
        <RootKnockoutProvider viewModel={vm}>
          <input
            type="checkbox"
            readOnly
            checked={!next}
            disabled={next}
            data-testid="form-property-ownership"
            data-bind="checked: checked, enable: enabled"
          />
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness next={false} />)
    const element = screen.getByTestId('form-property-ownership') as HTMLInputElement
    expect(element.checked).toBe(true)
    expect(element.disabled).toBe(false)

    rerender(<Harness next />)

    await waitFor(() => {
      expect(element.checked).toBe(true)
      expect(element.disabled).toBe(false)
    })
  })

  it('reapplies form-property bindings after a descendant local-state update', async () => {
    const vm = {
      checked: ko.observable(true),
      value: ko.observable('Knockout value'),
    }
    let update = () => undefined

    function LocalOwner() {
      const [next, setNext] = useState(false)
      update = () => setNext(true)
      return (
        <>
          <input
            readOnly
            value={next ? 'React next value' : 'React old value'}
            data-testid="local-value-ownership"
            data-bind="value: value"
          />
          <input
            type="checkbox"
            readOnly
            checked={!next}
            data-testid="local-checked-ownership"
            data-bind="checked: checked"
          />
        </>
      )
    }

    render(
      <RootKnockoutProvider viewModel={vm}>
        <LocalOwner />
      </RootKnockoutProvider>
    )
    const value = screen.getByTestId('local-value-ownership') as HTMLInputElement
    const checked = screen.getByTestId('local-checked-ownership') as HTMLInputElement

    act(() => update())

    await waitFor(() => {
      expect(value.value).toBe('Knockout value')
      expect(checked.checked).toBe(true)
    })
  })

  it('preserves a let descendant context when data-bind changes', async () => {
    const vm = {
      first: ko.observable('First alias'),
      second: ko.observable('Second alias'),
    }

    function Harness({ binding }: { binding: 'firstAlias' | 'secondAlias' }) {
      return (
        <RootKnockoutProvider viewModel={vm}>
          <div data-bind="let: { firstAlias: first, secondAlias: second }">
            <span data-bind={`text: ${binding}`} />
          </div>
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness binding="firstAlias" />)
    expect(screen.getByText('First alias')).toBeDefined()

    rerender(<Harness binding="secondAlias" />)

    await waitFor(() => {
      expect(screen.getByText('Second alias')).toBeDefined()
      expect(vm.first.getSubscriptionsCount()).toBe(0)
      expect(vm.second.getSubscriptionsCount()).toBe(1)
    })
  })

  it('rejects React children added while a content binding remains active', async () => {
    const vm = { label: ko.observable('Knockout text') }
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    function Harness({ show }: { show: boolean }) {
      return (
        <ErrorBoundary>
          <RootKnockoutProvider viewModel={vm}>
            <div data-bind="text: label">{show ? <button>React child</button> : null}</div>
          </RootKnockoutProvider>
        </ErrorBoundary>
      )
    }

    try {
      const { rerender } = render(<Harness show={false} />)
      rerender(<Harness show />)

      await waitFor(() => expect(screen.getByText('Binding failed')).toBeDefined())
      expect(vm.label.getSubscriptionsCount()).toBe(0)
    } finally {
      consoleError.mockRestore()
    }
  })

  it.each([
    ['text', 'text: text'],
    ['html', 'html: markup'],
    ['options', 'options: choices'],
  ] as const)('removes content left by a retired %s binding', async (kind, source) => {
    const vm = {
      text: 'Knockout text',
      markup: '<strong>Knockout HTML</strong>',
      choices: ['First', 'Second'],
    }

    function Harness({ bound }: { bound: boolean }) {
      return (
        <RootKnockoutProvider viewModel={vm}>
          {kind === 'options' ? (
            <select data-testid="content-owner" data-bind={bound ? source : undefined} />
          ) : (
            <div data-testid="content-owner" data-bind={bound ? source : undefined} />
          )}
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness bound />)
    const element = screen.getByTestId('content-owner')
    await waitFor(() => expect(element.childNodes.length).toBeGreaterThan(0))

    rerender(<Harness bound={false} />)

    await waitFor(() => expect(element.childNodes).toHaveLength(0))
  })

  it('removes content left by a retired component binding', async () => {
    const componentName = 'react-ko-retired-component-test'
    const vm = {}
    ko.components.register(componentName, {
      template: '<strong>Knockout component</strong>',
    })

    function Harness({ bound }: { bound: boolean }) {
      return (
        <RootKnockoutProvider viewModel={vm}>
          <div
            data-testid="component-owner"
            data-bind={bound ? `component: '${componentName}'` : undefined}
          />
        </RootKnockoutProvider>
      )
    }

    try {
      const { rerender } = render(<Harness bound />)
      const element = screen.getByTestId('component-owner')
      await waitFor(() => expect(element.textContent).toBe('Knockout component'))

      rerender(<Harness bound={false} />)

      await waitFor(() => expect(element.childNodes).toHaveLength(0))
    } finally {
      ko.components.unregister(componentName)
    }
  })

  it('removes retired Knockout content when data-bind is replaced', async () => {
    const vm = { label: 'Knockout text', title: 'Current title' }

    function Harness({ contentBinding }: { contentBinding: boolean }) {
      return (
        <RootKnockoutProvider viewModel={vm}>
          <span
            data-testid="replaced-binding"
            data-bind={contentBinding ? 'text: label' : 'attr: { title: title }'}
          />
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness contentBinding />)
    const element = screen.getByTestId('replaced-binding')
    expect(element.textContent).toBe('Knockout text')

    rerender(<Harness contentBinding={false} />)

    await waitFor(() => {
      expect(element.childNodes).toHaveLength(0)
      expect(element.title).toBe('Current title')
    })
  })

  it('preserves React children added while a content binding is retired', async () => {
    const vm = { label: 'Retired Knockout text' }
    const handleClick = vi.fn()

    function Harness({ bound, childLabel }: { bound: boolean; childLabel: string }) {
      return (
        <RootKnockoutProvider viewModel={vm}>
          <span data-testid="react-child-owner" data-bind={bound ? 'text: label' : undefined}>
            {bound ? null : <button onClick={handleClick}>{childLabel}</button>}
          </span>
        </RootKnockoutProvider>
      )
    }

    const { rerender, unmount } = render(<Harness bound childLabel="First React child" />)
    const element = screen.getByTestId('react-child-owner')
    expect(element.textContent).toBe('Retired Knockout text')

    rerender(<Harness bound={false} childLabel="First React child" />)

    await waitFor(() => expect(element.textContent).toBe('First React child'))
    const button = screen.getByRole('button')
    fireEvent.click(button)
    expect(handleClick).toHaveBeenCalledOnce()

    rerender(<Harness bound={false} childLabel="Updated React child" />)
    expect(screen.getByRole('button')).toBe(button)
    expect(button.textContent).toBe('Updated React child')
    expect(() => unmount()).not.toThrow()
  })

  it('retires a content binding before a newly mounted child updates its observable in a layout effect', () => {
    const vm = { label: ko.observable('Knockout text') }
    let connectedAfterUpdate = false
    let retireBinding = () => undefined

    function UpdatingChild() {
      const child = useRef<HTMLSpanElement>(null)

      useLayoutEffect(() => {
        vm.label('Updated in layout')
        connectedAfterUpdate = child.current?.isConnected ?? false
      }, [])

      return <span ref={child}>React child</span>
    }

    function BindingOwner() {
      const [bound, setBound] = useState(true)
      retireBinding = () => setBound(false)

      return (
        <div data-testid="layout-retirement" data-bind={bound ? 'text: label' : undefined}>
          {bound ? null : <UpdatingChild />}
        </div>
      )
    }

    render(
      <RootKnockoutProvider viewModel={vm}>
        <BindingOwner />
      </RootKnockoutProvider>
    )
    act(() => retireBinding())

    expect(connectedAfterUpdate).toBe(true)
    expect(screen.getByText('React child')).toBeDefined()
    expect(screen.getByTestId('layout-retirement').textContent).toBe('React child')
  })

  it.each(['using', 'let'] as const)(
    'forgets a captured %s context when its binding is retired before a late mount',
    async (binding) => {
      const vm = {
        label: ko.observable('Root label'),
        alias: ko.observable('Root alias'),
        scoped: { label: ko.observable('Scoped label') },
      }
      const source = binding === 'using' ? 'using: scoped' : 'let: { alias: scoped.label }'
      const descendantSource = binding === 'using' ? 'text: label' : 'text: alias'
      const rootText = binding === 'using' ? 'Root label' : 'Root alias'

      function Harness({ established, show }: { established: boolean; show: boolean }) {
        return (
          <RootKnockoutProvider viewModel={vm}>
            <div data-bind={established ? source : undefined}>
              {show ? <span data-bind={descendantSource} /> : null}
            </div>
          </RootKnockoutProvider>
        )
      }

      const { rerender } = render(<Harness established show={false} />)
      rerender(<Harness established={false} show={false} />)
      await act(async () => undefined)
      rerender(<Harness established={false} show />)

      await waitFor(() => expect(screen.getByText(rootText)).toBeDefined())
      expect(screen.queryByText('Scoped label')).toBeNull()
    }
  )

  it('rebinds a changed ancestor and restores nested scopes in their own context', async () => {
    const root = {
      first: ko.observable('Root first'),
      second: ko.observable('Root second'),
    }
    const nested = { second: ko.observable('Nested second') }

    function Harness({ binding }: { binding: 'first' | 'second' }) {
      return (
        <RootKnockoutProvider viewModel={root}>
          <section data-bind={`attr: { title: ${binding} }`}>
            <KnockoutScope viewModel={nested}>
              <span data-bind="text: second" />
            </KnockoutScope>
          </section>
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness binding="first" />)
    expect(screen.getByText('Nested second')).toBeDefined()

    rerender(<Harness binding="second" />)

    await waitFor(() => {
      expect(screen.getByText('Nested second')).toBeDefined()
      expect(root.first.getSubscriptionsCount()).toBe(0)
      expect(root.second.getSubscriptionsCount()).toBe(1)
      expect(nested.second.getSubscriptionsCount()).toBe(1)
    })
  })

  it('preserves the view model of a nested scope mounted later', async () => {
    const root = { label: ko.observable('Root') }
    const nested = { label: ko.observable('Nested') }

    function Harness({ show }: { show: boolean }) {
      return (
        <RootKnockoutProvider viewModel={root}>
          {show ? (
            <KnockoutScope viewModel={nested}>
              <span data-bind="text: label" />
            </KnockoutScope>
          ) : null}
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness show={false} />)
    rerender(<Harness show />)

    await waitFor(() => expect(screen.getByText('Nested')).toBeDefined())
    expect(screen.queryByText('Root')).toBeNull()
    expect(root.label.getSubscriptionsCount()).toBe(0)
    expect(nested.label.getSubscriptionsCount()).toBeGreaterThan(0)
  })

  it('rebinds and disposes the previous bindings when its view model changes', () => {
    const first = { label: ko.observable('First') }
    const second = { label: ko.observable('Second') }

    const { rerender } = render(
      <RootKnockoutProvider viewModel={first}>
        <span data-bind="text: label" />
      </RootKnockoutProvider>
    )

    expect(screen.getByText('First')).toBeDefined()
    expect(first.label.getSubscriptionsCount()).toBeGreaterThan(0)

    rerender(
      <RootKnockoutProvider viewModel={second}>
        <span data-bind="text: label" />
      </RootKnockoutProvider>
    )

    expect(screen.getByText('Second')).toBeDefined()
    expect(first.label.getSubscriptionsCount()).toBe(0)
    expect(second.label.getSubscriptionsCount()).toBeGreaterThan(0)
  })

  it('rebinds a replacement view model before descendant layout effects dispatch change events', () => {
    const first = { name: ko.observable('First') }
    const second = { name: ko.observable('Second') }

    function ChangeInLayout({ value }: { value: string | null }) {
      const input = useRef<HTMLInputElement>(null)

      useLayoutEffect(() => {
        if (value !== null && input.current !== null) {
          input.current.value = value
          input.current.dispatchEvent(new Event('change', { bubbles: true }))
        }
      }, [value])

      return <input ref={input} data-bind="value: name" />
    }

    function Harness({ viewModel, value }: { viewModel: typeof first; value: string | null }) {
      return (
        <RootKnockoutProvider viewModel={viewModel}>
          <ChangeInLayout value={value} />
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness viewModel={first} value={null} />)
    rerender(<Harness viewModel={second} value="Changed in layout" />)

    expect(first.name()).toBe('First')
    expect(second.name()).toBe('Changed in layout')
  })

  it('rebinds nested scopes after replacing the root view model', () => {
    const firstRoot = { label: ko.observable('Root A') }
    const secondRoot = { label: ko.observable('Root B') }
    const nested = { label: ko.observable('Nested A') }

    function Harness({ viewModel }: { viewModel: typeof firstRoot }) {
      return (
        <RootKnockoutProvider viewModel={viewModel}>
          <span data-bind="text: label" />
          <KnockoutScope viewModel={nested}>
            <span data-bind="text: label" />
          </KnockoutScope>
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness viewModel={firstRoot} />)
    expect(screen.getByText('Nested A')).toBeDefined()

    rerender(<Harness viewModel={secondRoot} />)

    act(() => {
      nested.label('Nested B')
    })

    expect(screen.getByText('Root B')).toBeDefined()
    expect(screen.getByText('Nested B')).toBeDefined()
    expect(nested.label.getSubscriptionsCount()).toBeGreaterThan(0)
  })

  it('creates an independent binding boundary when nested under another root', () => {
    const outer = { label: ko.observable('Outer') }
    const inner = { label: ko.observable('Inner') }

    const { unmount } = render(
      <RootKnockoutProvider viewModel={outer}>
        <span data-bind="text: label" />
        <RootKnockoutProvider viewModel={inner}>
          <span data-bind="text: label" />
        </RootKnockoutProvider>
      </RootKnockoutProvider>
    )

    expect(screen.getByText('Outer')).toBeDefined()
    expect(screen.getByText('Inner')).toBeDefined()
    expect(outer.label.getSubscriptionsCount()).toBeGreaterThan(0)
    expect(inner.label.getSubscriptionsCount()).toBeGreaterThan(0)

    unmount()

    expect(outer.label.getSubscriptionsCount()).toBe(0)
    expect(inner.label.getSubscriptionsCount()).toBe(0)
  })

  it('creates an independent binding boundary when nested under a scope', () => {
    const scope = { label: ko.observable('Scope') }
    const inner = { label: ko.observable('Inner root') }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={scope}>
          <span data-bind="text: label" />
          <RootKnockoutProvider viewModel={inner}>
            <span data-bind="text: label" />
          </RootKnockoutProvider>
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    expect(screen.getByText('Scope')).toBeDefined()
    expect(screen.getByText('Inner root')).toBeDefined()
  })

  it('rebinds a nested root after its enclosing scope is rebound', () => {
    const firstScope = { label: ko.observable('Scope A') }
    const secondScope = { label: ko.observable('Scope B') }
    const inner = { label: ko.observable('Inner A') }

    function Harness({ scope }: { scope: typeof firstScope }) {
      return (
        <RootKnockoutProvider viewModel={{}}>
          <KnockoutScope viewModel={scope}>
            <RootKnockoutProvider viewModel={inner}>
              <span data-bind="text: label" />
            </RootKnockoutProvider>
          </KnockoutScope>
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness scope={firstScope} />)
    expect(screen.getByText('Inner A')).toBeDefined()

    rerender(<Harness scope={secondScope} />)

    act(() => {
      inner.label('Inner B')
    })

    expect(screen.getByText('Inner B')).toBeDefined()
    expect(inner.label.getSubscriptionsCount()).toBeGreaterThan(0)
  })

  it('disposes its bindings on unmount', () => {
    const vm = { label: ko.observable('Mounted') }

    const { unmount } = render(
      <RootKnockoutProvider viewModel={vm}>
        <span data-bind="text: label" />
      </RootKnockoutProvider>
    )

    expect(vm.label.getSubscriptionsCount()).toBeGreaterThan(0)

    unmount()

    expect(vm.label.getSubscriptionsCount()).toBe(0)
  })

  it('disposes bindings created before a later binding throws', () => {
    const vm = { label: ko.observable('Subscribed') }
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    try {
      render(
        <ErrorBoundary>
          <RootKnockoutProvider viewModel={vm}>
            <span data-bind="text: label" />
            <span data-bind="text: missing.value" />
          </RootKnockoutProvider>
        </ErrorBoundary>
      )
    } finally {
      consoleError.mockRestore()
    }

    expect(screen.getByText('Binding failed')).toBeDefined()
    expect(vm.label.getSubscriptionsCount()).toBe(0)
  })

  it('binds once and cleans up correctly under StrictMode', () => {
    const vm = { label: ko.observable('Strict') }

    const { unmount } = render(
      <StrictMode>
        <RootKnockoutProvider viewModel={vm}>
          <span data-bind="text: label" />
        </RootKnockoutProvider>
      </StrictMode>
    )

    expect(screen.getByText('Strict')).toBeDefined()
    expect(vm.label.getSubscriptionsCount()).toBe(1)

    unmount()

    expect(vm.label.getSubscriptionsCount()).toBe(0)
  })

  it('does not throw when useAppViewModel is used inside RootKnockoutProvider', () => {
    const vm = {}
  
    const renderSafeUsage = () => {
      render(
        <RootKnockoutProvider viewModel={vm}>
          <ViewModelConsumer />
        </RootKnockoutProvider>
      )
    }
  
    expect(renderSafeUsage).not.toThrow()
  })

  it('throws clear error when useAppViewModel is called without AppViewModelContext.Provider', () => {
    const errorFn = () => {
      render(<ViewModelConsumer />)
    }
  
    expect(errorFn).toThrow(
      'useAppViewModel must be used within an AppViewModelContext.Provider.'
    )
  })

  it('surfaces a binding error raised by a late non-React descendant', async () => {
    render(
      <ErrorBoundary>
        <RootKnockoutProvider viewModel={{}}>
          <div data-testid="root-host" />
        </RootKnockoutProvider>
      </ErrorBoundary>
    )
    const host = screen.getByTestId('root-host')

    const el = document.createElement('span')
    el.setAttribute('data-bind', 'text: missing.value')
    act(() => {
      host.appendChild(el)
    })

    await waitFor(() => expect(screen.getByText('Binding failed')).toBeDefined())
  })

  it('rejects a content binding over dangerouslySetInnerHTML content', () => {
    const vm = { label: ko.observable('never') }

    render(
      <ErrorBoundary>
        <RootKnockoutProvider viewModel={vm}>
          <div
            data-bind="text: label"
            dangerouslySetInnerHTML={{ __html: '<span>markup</span>' }}
          />
        </RootKnockoutProvider>
      </ErrorBoundary>
    )

    expect(screen.getByText('Binding failed')).toBeDefined()
  })

  it('rejects a content binding that would overwrite React-owned children', () => {
    const vm = { label: ko.observable('never') }

    render(
      <ErrorBoundary>
        <RootKnockoutProvider viewModel={vm}>
          <div data-bind="text: label">
            <span>React child</span>
          </div>
        </RootKnockoutProvider>
      </ErrorBoundary>
    )

    expect(screen.getByText('Binding failed')).toBeDefined()
  })

  it('surfaces a structural binding rejected at initial mount and unbinds cleanly', () => {
    const vm = { visible: ko.observable(true) }

    const { unmount } = render(
      <ErrorBoundary>
        <RootKnockoutProvider viewModel={vm}>
          <div data-bind="if: visible">
            <span />
          </div>
        </RootKnockoutProvider>
      </ErrorBoundary>
    )

    expect(screen.getByText('Binding failed')).toBeDefined()

    unmount()
  })
})
