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
import { KnockoutScope } from '@/index'
import { BindingHost } from '../../fixtures/bindingHost'

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
      <BindingHost viewModel={root}>
        {createPortal(
          <span data-testid="root-portal" data-bind="text: label" />,
          rootTarget
        )}
        <BindingHost viewModel={scope}>
          {createPortal(
            <span data-testid="scope-portal" data-bind="text: label" />,
            scopeTarget
          )}
        </BindingHost>
      </BindingHost>
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
      <BindingHost viewModel={{}}>
        <BindingHost viewModel={outer}>
          <div
            ref={(node) => {
              node?.appendChild(target)
            }}
          />
        </BindingHost>
        <BindingHost viewModel={inner}>
          {createPortal(
            <span data-testid="cross-scope-portal" data-bind="text: label" />,
            target
          )}
        </BindingHost>
      </BindingHost>
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
      <BindingHost viewModel={vm}>
        {createPortal(
          createPortal(
            <span data-testid="nested-portal" data-bind="text: label" />,
            secondTarget
          ),
          firstTarget
        )}
      </BindingHost>
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
      <BindingHost viewModel={outer}>
        {createPortal(
          <BindingHost viewModel={inner}>
            <span data-testid="portal-nested-scope" data-bind="text: label" />
          </BindingHost>,
          target
        )}
      </BindingHost>
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
          <BindingHost viewModel={{ label: ko.observable('Knockout') }}>
            {createPortal(
              <span>React child</span>,
              target
            )}
          </BindingHost>
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
        <BindingHost viewModel={{}}>
          {createPortal(<PortalChild />, target)}
        </BindingHost>
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
        <BindingHost viewModel={{}}>
          <BindingHost viewModel={viewModel}>
            {createPortal(
              <input data-testid="replacement-portal" data-bind="value: label" />,
              target
            )}
          </BindingHost>
        </BindingHost>
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
        <BindingHost viewModel={viewModel}>
          <div ref={attachTarget} />
          {target === null
            ? null
            : createPortal(
                <span data-testid="contained-portal" data-bind="text: label" />,
                target
              )}
        </BindingHost>
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
        <KnockoutScope viewModel={vm}>
          {visible ? createPortal(<LatePortalInput />, target) : null}
        </KnockoutScope>
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

  it('manages the complete portal lifecycle in an iframe realm', () => {
    const iframe = document.createElement('iframe')
    document.body.appendChild(iframe)
    const foreignDocument = iframe.contentDocument!
    const foreignWindow = iframe.contentWindow as Window & typeof globalThis
    const target = foreignDocument.createElement('div')
    foreignDocument.body.appendChild(target)
    const originalAppendChild = foreignWindow.Node.prototype.appendChild
    const originalValueSetter = Object.getOwnPropertyDescriptor(
      foreignWindow.HTMLInputElement.prototype,
      'value'
    )?.set
    const first = { label: ko.observable('First') }
    const second = { label: ko.observable('Second') }

    function Harness({
      viewModel,
      showLate,
    }: {
      viewModel: typeof first
      showLate: boolean
    }) {
      return (
        <BindingHost viewModel={{}}>
          <BindingHost viewModel={viewModel}>
            {createPortal(
              <div>
                <input data-bind="value: label" />
                {showLate ? <span data-bind="text: label" /> : null}
              </div>,
              target
            )}
          </BindingHost>
        </BindingHost>
      )
    }

    let mounted: ReturnType<typeof render> | undefined
    try {
      mounted = render(<Harness viewModel={first} showLate={false} />)
      const input = target.querySelector('input')

      expect(input).toHaveProperty('value', 'First')
      expect(first.label.getSubscriptionsCount()).toBeGreaterThan(0)
      expect(foreignWindow.Node.prototype.appendChild).not.toBe(originalAppendChild)
      expect(
        Object.getOwnPropertyDescriptor(
          foreignWindow.HTMLInputElement.prototype,
          'value'
        )?.set
      ).not.toBe(originalValueSetter)

      mounted.rerender(<Harness viewModel={first} showLate />)
      expect(target.querySelector('span')).toHaveProperty('textContent', 'First')

      mounted.rerender(<Harness viewModel={second} showLate />)
      expect(target.querySelector('input')).toHaveProperty('value', 'Second')
      expect(target.querySelector('span')).toHaveProperty('textContent', 'Second')
      expect(first.label.getSubscriptionsCount()).toBe(0)
      expect(second.label.getSubscriptionsCount()).toBeGreaterThan(0)

      mounted.unmount()
      mounted = undefined
      expect(second.label.getSubscriptionsCount()).toBe(0)
      expect(foreignWindow.Node.prototype.appendChild).toBe(originalAppendChild)
      expect(
        Object.getOwnPropertyDescriptor(
          foreignWindow.HTMLInputElement.prototype,
          'value'
        )?.set
      ).toBe(originalValueSetter)
    } finally {
      mounted?.unmount()
      iframe.remove()
    }
  })

  it('disposes every portal root when binding a newly added portal fails', () => {
    const firstTarget = portalTarget()
    const secondTarget = portalTarget()
    const added = ko.observable('Added')
    const existing = ko.observable('Existing')
    const binding = 'throwDuringPortalBinding'
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    ko.bindingHandlers[binding] = {
      init() {
        throw new Error('Portal binding failed')
      },
    }

    function Harness({ addFailingPortal }: { addFailingPortal: boolean }) {
      return (
        <ErrorBoundary>
          <BindingHost viewModel={{ added, existing }}>
            {addFailingPortal
              ? createPortal(
                  <div>
                    <input data-bind="value: added" />
                    <span data-bind={`${binding}: true`} />
                  </div>,
                  firstTarget
                )
              : null}
            {createPortal(
              <input data-bind="value: existing" />,
              secondTarget
            )}
          </BindingHost>
        </ErrorBoundary>
      )
    }

    try {
      const { rerender } = render(<Harness addFailingPortal={false} />)
      expect(existing.getSubscriptionsCount()).toBeGreaterThan(0)

      rerender(<Harness addFailingPortal />)

      expect(screen.getByText(/Portal binding failed/)).toBeDefined()
      expect(added.getSubscriptionsCount()).toBe(0)
      expect(existing.getSubscriptionsCount()).toBe(0)
    } finally {
      delete ko.bindingHandlers[binding]
      consoleError.mockRestore()
    }
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
