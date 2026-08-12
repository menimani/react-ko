import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import {
  Component,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import ko from 'knockout'
import { KnockoutScope, RootKnockoutProvider } from '@/index'

const portalTargets: HTMLElement[] = []

function portalTarget() {
  const target = document.createElement('div')
  document.body.appendChild(target)
  portalTargets.push(target)
  return target
}

afterEach(() => {
  for (const target of portalTargets.splice(0)) target.remove()
})

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    return this.state.error === null
      ? this.props.children
      : <span>{this.state.error.message}</span>
  }
}

describe('portal bindings', () => {
  it('binds portal content to its owning root and nearest React scope', () => {
    const rootTarget = portalTarget()
    const scopeTarget = portalTarget()
    const root = { label: ko.observable('Root') }
    const scope = { label: ko.observable('Scope') }

    render(
      <RootKnockoutProvider viewModel={root}>
        {createPortal(
          <span data-testid="root-portal" data-bind="text: label" />,
          rootTarget
        )}
        <KnockoutScope viewModel={scope}>
          {createPortal(
            <span data-testid="scope-portal" data-bind="text: label" />,
            scopeTarget
          )}
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    expect(screen.getByTestId('root-portal')).toHaveProperty('textContent', 'Root')
    expect(screen.getByTestId('scope-portal')).toHaveProperty('textContent', 'Scope')

    act(() => {
      root.label('Updated root')
      scope.label('Updated scope')
    })

    expect(screen.getByTestId('root-portal')).toHaveProperty(
      'textContent',
      'Updated root'
    )
    expect(screen.getByTestId('scope-portal')).toHaveProperty(
      'textContent',
      'Updated scope'
    )
  })

  it('uses React-tree ownership when a portal lands inside another scope', () => {
    const target = portalTarget()
    const outer = { label: ko.observable('Outer') }
    const inner = { label: ko.observable('Inner') }

    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={outer}>
          <div ref={(node) => node?.appendChild(target)} />
        </KnockoutScope>
        <KnockoutScope viewModel={inner}>
          {createPortal(
            <span data-testid="cross-scope-portal" data-bind="text: label" />,
            target
          )}
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    expect(screen.getByTestId('cross-scope-portal')).toHaveProperty(
      'textContent',
      'Inner'
    )
  })

  it('binds nested portals to the scope of their host portal', () => {
    const firstTarget = portalTarget()
    const secondTarget = portalTarget()
    const vm = { label: ko.observable('Nested') }

    render(
      <RootKnockoutProvider viewModel={vm}>
        {createPortal(
          createPortal(
            <span data-testid="nested-portal" data-bind="text: label" />,
            secondTarget
          ),
          firstTarget
        )}
      </RootKnockoutProvider>
    )

    expect(screen.getByTestId('nested-portal')).toHaveProperty(
      'textContent',
      'Nested'
    )
  })

  it('leaves portal content beneath a nested React scope to that scope', () => {
    const target = portalTarget()
    const outer = { label: ko.observable('Outer') }
    const inner = { label: ko.observable('Inner') }

    render(
      <RootKnockoutProvider viewModel={outer}>
        {createPortal(
          <KnockoutScope viewModel={inner}>
            <span data-testid="portal-nested-scope" data-bind="text: label" />
          </KnockoutScope>,
          target
        )}
      </RootKnockoutProvider>
    )

    expect(screen.getByTestId('portal-nested-scope')).toHaveProperty(
      'textContent',
      'Inner'
    )
    expect(outer.label.getSubscriptionsCount()).toBe(0)
    expect(inner.label.getSubscriptionsCount()).toBeGreaterThan(0)
  })

  it('audits descendant-controller writes against React-owned portal nodes', () => {
    const target = portalTarget()
    target.setAttribute('data-bind', 'text: label')
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    try {
      render(
        <ErrorBoundary>
          <RootKnockoutProvider viewModel={{ label: ko.observable('Knockout') }}>
            {createPortal(
              <span>React child</span>,
              target
            )}
          </RootKnockoutProvider>
        </ErrorBoundary>
      )

      expect(
        screen.getByText(
          'react-ko cannot apply the Knockout "text" binding because it controls React-owned child nodes. Leave the bound element empty so Knockout can own its contents.'
        )
      ).toBeDefined()
    } finally {
      consoleError.mockRestore()
    }
  })

  it('disposes portal bindings before React descendant layout cleanup', () => {
    const target = portalTarget()
    const events: string[] = []
    const binding = 'portalDisposeOrder'
    ko.bindingHandlers[binding] = {
      init(element) {
        ko.utils.domNodeDisposal.addDisposeCallback(element, () => {
          events.push('knockout')
        })
      },
    }

    function PortalChild() {
      useLayoutEffect(
        () => () => {
          events.push('react')
        },
        []
      )
      return <span data-bind={`${binding}: true`} />
    }

    try {
      const { unmount } = render(
        <RootKnockoutProvider viewModel={{}}>
          {createPortal(<PortalChild />, target)}
        </RootKnockoutProvider>
      )

      unmount()

      expect(events).toEqual(['knockout', 'react'])
    } finally {
      delete ko.bindingHandlers[binding]
    }
  })

  it('rebinds portal content and disposes the previous scope on replacement', () => {
    const target = portalTarget()
    const first = { label: ko.observable('First') }
    const second = { label: ko.observable('Second') }

    function Harness({ viewModel }: { viewModel: typeof first }) {
      return (
        <RootKnockoutProvider viewModel={{}}>
          <KnockoutScope viewModel={viewModel}>
            {createPortal(
              <input data-testid="replacement-portal" data-bind="value: label" />,
              target
            )}
          </KnockoutScope>
        </RootKnockoutProvider>
      )
    }

    const { rerender, unmount } = render(<Harness viewModel={first} />)
    expect(screen.getByTestId('replacement-portal')).toHaveProperty('value', 'First')
    expect(first.label.getSubscriptionsCount()).toBeGreaterThan(0)

    rerender(<Harness viewModel={second} />)

    expect(screen.getByTestId('replacement-portal')).toHaveProperty('value', 'Second')
    expect(first.label.getSubscriptionsCount()).toBe(0)
    expect(second.label.getSubscriptionsCount()).toBeGreaterThan(0)

    unmount()
    expect(second.label.getSubscriptionsCount()).toBe(0)
  })

  it('replaces a scope whose portal target is inside its own DOM', () => {
    const first = { label: ko.observable('First') }
    const second = { label: ko.observable('Second') }

    function Harness({ viewModel }: { viewModel: typeof first }) {
      const [target, setTarget] = useState<HTMLDivElement | null>(null)
      const attachTarget = useCallback((node: HTMLDivElement | null) => {
        setTarget(node)
      }, [])
      return (
        <RootKnockoutProvider viewModel={viewModel}>
          <div ref={attachTarget} />
          {target === null
            ? null
            : createPortal(
                <span data-testid="contained-portal" data-bind="text: label" />,
                target
              )}
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness viewModel={first} />)
    expect(screen.getByTestId('contained-portal')).toHaveProperty(
      'textContent',
      'First'
    )

    rerender(<Harness viewModel={second} />)

    expect(screen.getByTestId('contained-portal')).toHaveProperty(
      'textContent',
      'Second'
    )
    expect(first.label.getSubscriptionsCount()).toBe(0)
    expect(second.label.getSubscriptionsCount()).toBeGreaterThan(0)
  })

  it('binds a late portal and disposes it while its scope remains mounted', () => {
    const target = portalTarget()
    const vm = { label: ko.observable('Late') }

    function LatePortalInput() {
      const input = useRef<HTMLInputElement>(null)
      useLayoutEffect(() => {
        if (input.current === null) return
        input.current.value = 'Changed during layout'
        input.current.dispatchEvent(new Event('input', { bubbles: true }))
      }, [])
      return (
        <input
          ref={input}
          data-testid="late-portal"
          data-bind="textInput: label"
        />
      )
    }

    function Harness({ visible }: { visible: boolean }) {
      return (
        <RootKnockoutProvider viewModel={vm}>
          {visible ? createPortal(<LatePortalInput />, target) : null}
        </RootKnockoutProvider>
      )
    }

    const { rerender } = render(<Harness visible={false} />)
    expect(vm.label.getSubscriptionsCount()).toBe(0)

    rerender(<Harness visible />)
    expect(screen.getByTestId('late-portal')).toHaveProperty(
      'value',
      'Changed during layout'
    )
    expect(vm.label()).toBe('Changed during layout')
    expect(vm.label.getSubscriptionsCount()).toBeGreaterThan(0)

    rerender(<Harness visible={false} />)
    expect(screen.queryByTestId('late-portal')).toBeNull()
    expect(vm.label.getSubscriptionsCount()).toBe(0)
  })

  it('leaves portals outside a binding scope unbound', () => {
    const target = portalTarget()
    const vm = { label: ko.observable('Unbound') }

    render(createPortal(
      <span data-testid="unbound-portal" data-bind="text: label" />,
      target
    ))

    expect(screen.getByTestId('unbound-portal')).toHaveProperty('textContent', '')
    expect(vm.label.getSubscriptionsCount()).toBe(0)
  })
})
