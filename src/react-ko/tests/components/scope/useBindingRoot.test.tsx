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
import { KoForeach } from '@/index'
import { BindingHost } from '../../fixtures/bindingHost'

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
        <BindingHost viewModel={replacement ? second : first}>
          <Suspense fallback={null}>
            {replacement ? <SuspendedReplacement /> : null}
          </Suspense>
          <LateChild />
        </BindingHost>
      )
    }

    render(<Harness />)

    await act(async () => {
      startTransition(replaceViewModel)
    })
    act(showLateChild)

    expect(screen.getByTestId('late-child')).toHaveProperty('textContent', 'First')
  })

  const bindingRoots = ['BindingHost', 'BindingHost'] as const
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
        bindingRoot === 'BindingHost' ? (
          <BindingHost viewModel={{}}>{children}</BindingHost>
        ) : (
          <BindingHost viewModel={{}}>
            <BindingHost viewModel={{}}>{children}</BindingHost>
          </BindingHost>
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
        return bindingRoot === 'BindingHost' ? (
          <BindingHost viewModel={viewModel}>{child}</BindingHost>
        ) : (
          <BindingHost viewModel={{}}>
            <BindingHost viewModel={viewModel}>{child}</BindingHost>
          </BindingHost>
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
        return bindingRoot === 'BindingHost' ? (
          <BindingHost viewModel={viewModel}>{child}</BindingHost>
        ) : (
          <BindingHost viewModel={{}}>
            <BindingHost viewModel={viewModel}>{child}</BindingHost>
          </BindingHost>
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

  // The layout-ordering matrix covered the structural components, which are gone.
  // A root now comes from the caller's own ref, and React attaches refs from the bottom
  // up, so a descendant layout effect can run before the root it sits in has bound. That
  // gap is stated in useKoBind's documentation.

  it('unmounts cleanly when a rebind fails after the old binding was disposed', () => {
    const vmA = { label: ko.observable('First') }
    const vmB = { label: ko.observable('Second'), items: ko.observableArray<string>([]) }

    function Harness({ vm, bad }: { vm: unknown; bad: boolean }) {
      return (
        <ErrorBoundary>
          <BindingHost viewModel={{}}>
            <BindingHost viewModel={vm}>
              {bad ? (
                <div data-bind="foreach: items">
                  <span />
                </div>
              ) : (
                <span data-bind="text: label" />
              )}
            </BindingHost>
          </BindingHost>
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
