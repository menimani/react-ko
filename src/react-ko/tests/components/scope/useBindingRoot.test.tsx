import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { Component, useLayoutEffect, useRef, type ReactElement, type ReactNode } from 'react'
import ko from 'knockout'
import {
  RootKnockoutProvider,
  KnockoutScope,
  KoForeach,
  KoIf,
  KoIfNot,
  KoWith,
} from '@/index'

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? <span>Binding failed</span> : this.props.children
  }
}

describe('useBindingRoot', () => {
  const bindingRoots = ['RootKnockoutProvider', 'KnockoutScope'] as const
  const childUpdates = ['mounts', 'rebinds'] as const

  it.each(
    bindingRoots.flatMap((bindingRoot) =>
      childUpdates.map((childUpdate) => [bindingRoot, childUpdate] as const)
    )
  )(
    '%s uses the replacement ViewModel when it %s a child in the same commit',
    (bindingRoot, childUpdate) => {
      const first = { firstLabel: ko.observable('First') }
      const second = { secondLabel: ko.observable('Second') }

      function BoundChild({ replacement }: { replacement: boolean }) {
        if (childUpdate === 'mounts' && !replacement) return null
        return (
          <span
            data-testid="simultaneous-update"
            data-bind={replacement ? 'text: secondLabel' : 'text: firstLabel'}
          />
        )
      }

      function Harness({
        viewModel,
        replacement,
      }: {
        viewModel: typeof first | typeof second
        replacement: boolean
      }) {
        const child = <BoundChild replacement={replacement} />
        return bindingRoot === 'RootKnockoutProvider' ? (
          <RootKnockoutProvider viewModel={viewModel}>{child}</RootKnockoutProvider>
        ) : (
          <RootKnockoutProvider viewModel={{}}>
            <KnockoutScope viewModel={viewModel}>{child}</KnockoutScope>
          </RootKnockoutProvider>
        )
      }

      const { rerender } = render(
        <Harness viewModel={first} replacement={false} />
      )

      rerender(<Harness viewModel={second} replacement />)

      expect(screen.getByTestId('simultaneous-update')).toHaveProperty(
        'textContent',
        'Second'
      )
    }
  )

  type StructuralToggle = (label: ko.Observable<string>) => {
    element: ReactElement
    reveal: () => void
  }

  const structuralToggles: Array<[string, StructuralToggle]> = [
    [
      'KoIf',
      (label) => {
        const visible = ko.observable(false)
        return {
          element: (
            <RootKnockoutProvider viewModel={{ label }}>
              <KoIf condition={visible}>
                <LayoutInput />
              </KoIf>
            </RootKnockoutProvider>
          ),
          reveal: () => visible(true),
        }
      },
    ],
    [
      'KoIfNot',
      (label) => {
        const hidden = ko.observable(true)
        return {
          element: (
            <RootKnockoutProvider viewModel={{ label }}>
              <KoIfNot condition={hidden}>
                <LayoutInput />
              </KoIfNot>
            </RootKnockoutProvider>
          ),
          reveal: () => hidden(false),
        }
      },
    ],
    [
      'KoForeach',
      (label) => {
        const items = ko.observableArray<{ label: ko.Observable<string> }>([])
        return {
          element: (
            <RootKnockoutProvider viewModel={{}}>
              <KoForeach items={items}>{() => <LayoutInput />}</KoForeach>
            </RootKnockoutProvider>
          ),
          reveal: () => items.push({ label }),
        }
      },
    ],
    [
      'KoWith',
      (label) => {
        const value = ko.observable<{ label: ko.Observable<string> } | null>(null)
        return {
          element: (
            <RootKnockoutProvider viewModel={{}}>
              <KoWith value={value}>{() => <LayoutInput />}</KoWith>
            </RootKnockoutProvider>
          ),
          reveal: () => value({ label }),
        }
      },
    ],
  ]

  function LayoutInput() {
    const input = useRef<HTMLInputElement>(null)
    useLayoutEffect(() => {
      if (input.current === null) return
      input.current.value = 'Changed during layout'
      input.current.dispatchEvent(new Event('input', { bubbles: true }))
    }, [])
    return <input ref={input} data-testid="layout-input" data-bind="textInput: label" />
  }

  it.each(structuralToggles)(
    'binds a newly revealed %s scope before descendant layout effects',
    (_, createToggle) => {
      const label = ko.observable('Initial')
      const { element, reveal } = createToggle(label)
      render(element)

      act(reveal)

      expect(label()).toBe('Changed during layout')
      expect(screen.getByTestId('layout-input')).toHaveProperty(
        'value',
        'Changed during layout'
      )
    }
  )

  it('unmounts cleanly when a rebind fails after the old binding was disposed', () => {
    const vmA = { label: ko.observable('First') }
    const vmB = { label: ko.observable('Second'), items: ko.observableArray<string>([]) }

    function Harness({ vm, bad }: { vm: unknown; bad: boolean }) {
      return (
        <ErrorBoundary>
          <RootKnockoutProvider viewModel={{}}>
            <KnockoutScope viewModel={vm}>
              {bad ? (
                <div data-bind="foreach: items">
                  <span />
                </div>
              ) : (
                <span data-bind="text: label" />
              )}
            </KnockoutScope>
          </RootKnockoutProvider>
        </ErrorBoundary>
      )
    }

    const { rerender, unmount } = render(<Harness vm={vmA} bad={false} />)
    expect(screen.getByText('First')).toBeDefined()

    // The rebind disposes the old binding first, so its failure leaves no
    // active binding behind; unmounting afterwards must not crash on it.
    rerender(<Harness vm={vmB} bad />)
    expect(screen.getByText('Binding failed')).toBeDefined()

    unmount()

    expect(vmA.label.getSubscriptionsCount()).toBe(0)
  })
})
