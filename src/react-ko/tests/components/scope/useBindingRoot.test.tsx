import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import {
  Component,
  Suspense,
  startTransition,
  useLayoutEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
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
  it('continues binding children after an interrupted ViewModel replacement', async () => {
    const first = { label: ko.observable('First') }
    const second = { label: ko.observable('Second') }
    const suspended = new Promise<void>(() => undefined)
    let replaceViewModel = () => undefined
    let showLateChild = () => undefined

    function SuspendedReplacement() {
      throw suspended
    }

    function LateChild() {
      const [visible, setVisible] = useState(false)
      showLateChild = () => setVisible(true)
      return visible ? <span data-testid="late-child" data-bind="text: label" /> : null
    }

    function Harness() {
      const [replacement, setReplacement] = useState(false)
      replaceViewModel = () => setReplacement(true)
      return (
        <RootKnockoutProvider viewModel={replacement ? second : first}>
          <Suspense fallback={null}>
            {replacement ? <SuspendedReplacement /> : null}
          </Suspense>
          <LateChild />
        </RootKnockoutProvider>
      )
    }

    render(<Harness />)

    await act(async () => {
      startTransition(replaceViewModel)
    })
    act(showLateChild)

    expect(screen.getByTestId('late-child')).toHaveProperty('textContent', 'First')
  })

  const bindingRoots = ['RootKnockoutProvider', 'KnockoutScope'] as const
  const childUpdates = ['mounts', 'rebinds'] as const

  it.each(bindingRoots)(
    '%s preserves direct child identity and order in its binding host',
    (bindingRoot) => {
      const children = (
        <>
          <span data-testid="first-direct-child" />
          <button data-testid="second-direct-child" />
        </>
      )
      const tree =
        bindingRoot === 'RootKnockoutProvider' ? (
          <RootKnockoutProvider viewModel={{}}>{children}</RootKnockoutProvider>
        ) : (
          <RootKnockoutProvider viewModel={{}}>
            <KnockoutScope viewModel={{}}>{children}</KnockoutScope>
          </RootKnockoutProvider>
        )

      render(tree)

      const first = screen.getByTestId('first-direct-child')
      const second = screen.getByTestId('second-direct-child')
      const host = first.parentElement!
      expect(Array.from(host.children)).toEqual([first, second])
      expect(host.firstElementChild).toBe(first)
      expect(host.querySelector(':scope > :first-child')).toBe(first)
    }
  )

  it.each(bindingRoots)(
    '%s mounts descendant refs in the initial commit seen by an ancestor layout effect',
    (bindingRoot) => {
      const viewModel = { label: ko.observable('Bound') }
      let observed: HTMLSpanElement | null = null

      function Ancestor() {
        const descendant = useRef<HTMLSpanElement>(null)
        useLayoutEffect(() => {
          observed = descendant.current
        }, [])
        const child = <span ref={descendant} data-bind="text: label" />
        return bindingRoot === 'RootKnockoutProvider' ? (
          <RootKnockoutProvider viewModel={viewModel}>{child}</RootKnockoutProvider>
        ) : (
          <RootKnockoutProvider viewModel={{}}>
            <KnockoutScope viewModel={viewModel}>{child}</KnockoutScope>
          </RootKnockoutProvider>
        )
      }

      render(<Ancestor />)

      expect(observed).not.toBeNull()
      expect(observed).toHaveProperty('textContent', 'Bound')
    }
  )

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
    // KoForeach is absent from this matrix by decision, not by oversight. A row's
    // binding root is established from the ref on the caller's own element, and React
    // attaches refs from the bottom up, so the row is bound after its descendants have
    // run their layout effects. Restoring the guarantee means revisiting the engine's
    // "an ancestor root binds before the roots inside it" ordering, which is deferred.
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
