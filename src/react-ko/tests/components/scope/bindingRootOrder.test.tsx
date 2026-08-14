import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { type ReactNode } from 'react'
import ko from 'knockout'
import { useKoBind } from '@/index'

function Host({
  viewModel,
  children,
  testId,
}: {
  viewModel: unknown
  children?: ReactNode
  testId?: string
}) {
  const bind = useKoBind(viewModel)
  return (
    <div {...bind} data-testid={testId}>
      {children}
    </div>
  )
}

describe('binding root order', () => {
  it('binds a root inside another root', () => {
    const outer = { outerLabel: ko.observable('outer') }
    const inner = { innerLabel: ko.observable('inner') }

    const { container } = render(
      <Host viewModel={outer}>
        <span data-bind="text: outerLabel" />
        <Host viewModel={inner}>
          <span data-bind="text: innerLabel" />
        </Host>
      </Host>
    )

    expect(container.textContent).toBe('outerinner')

    // Each root owns its own subtree afterwards, so both stay live.
    act(() => {
      outer.outerLabel('outer changed')
      inner.innerLabel('inner changed')
    })
    expect(container.textContent).toBe('outer changedinner changed')
  })

  it.each([null, undefined])(
    'binds and disposes a root inside a disabled %s root',
    (missingViewModel) => {
      const inner = { label: ko.observable('inner') }

      const { container, unmount } = render(
        <Host viewModel={missingViewModel}>
          <Host viewModel={inner}>
            <span data-bind="text: label" />
          </Host>
        </Host>
      )

      expect(container.textContent).toBe('inner')
      expect(inner.label.getSubscriptionsCount()).toBeGreaterThan(0)

      act(() => inner.label('inner changed'))
      expect(container.textContent).toBe('inner changed')

      unmount()
      expect(inner.label.getSubscriptionsCount()).toBe(0)
    }
  )

  it('binds every level of a three-deep nest', () => {
    const a = { a: ko.observable('A') }
    const b = { b: ko.observable('B') }
    const c = { c: ko.observable('C') }

    const { container } = render(
      <Host viewModel={a}>
        <span data-bind="text: a" />
        <Host viewModel={b}>
          <span data-bind="text: b" />
          <Host viewModel={c}>
            <span data-bind="text: c" />
          </Host>
        </Host>
      </Host>
    )

    expect(container.textContent).toBe('ABC')
  })

  it('binds sibling roots and the root nested inside one of them', () => {
    const outer = { outer: ko.observable('outer') }
    const left = { left: ko.observable('left') }
    const right = { right: ko.observable('right') }
    const deep = { deep: ko.observable('deep') }

    const { container } = render(
      <Host viewModel={outer}>
        <span data-bind="text: outer" />
        <Host viewModel={left}>
          <span data-bind="text: left" />
          <Host viewModel={deep}>
            <span data-bind="text: deep" />
          </Host>
        </Host>
        <Host viewModel={right}>
          <span data-bind="text: right" />
        </Host>
      </Host>
    )

    expect(container.textContent).toBe('outerleftdeepright')

    act(() => {
      left.left('left changed')
      right.right('right changed')
      deep.deep('deep changed')
    })
    expect(container.textContent).toBe('outerleft changeddeep changedright changed')
  })

  it('keeps an inner root out of the outer view model', () => {
    const outer = { label: ko.observable('outer label') }
    const inner = { label: ko.observable('inner label') }

    render(
      <Host viewModel={outer} testId="outer">
        <Host viewModel={inner} testId="inner">
          <span data-testid="value" data-bind="text: label" />
        </Host>
      </Host>
    )

    expect(screen.getByTestId('value').textContent).toBe('inner label')
    expect(ko.dataFor(screen.getByTestId('value'))).toBe(inner)
    expect(ko.dataFor(screen.getByTestId('outer'))).toBe(outer)
  })

  it('binds an inner root mounted after its ancestor is already bound', () => {
    const outer = { outerLabel: ko.observable('outer') }
    const inner = { innerLabel: ko.observable('inner') }

    function Harness({ showInner }: { showInner: boolean }) {
      return (
        <Host viewModel={outer}>
          <span data-bind="text: outerLabel" />
          {showInner ? (
            <Host viewModel={inner}>
              <span data-testid="inner" data-bind="text: innerLabel" />
            </Host>
          ) : null}
        </Host>
      )
    }

    const { rerender } = render(<Harness showInner={false} />)
    rerender(<Harness showInner />)

    expect(screen.getByTestId('inner').textContent).toBe('inner')
    act(() => inner.innerLabel('inner changed'))
    expect(screen.getByTestId('inner').textContent).toBe('inner changed')
  })

  it('drops an inner root whose element leaves before it could bind', () => {
    const outer = { outerLabel: ko.observable('outer') }
    const inner = { innerLabel: ko.observable('inner') }

    function Harness({ showInner }: { showInner: boolean }) {
      return (
        <Host viewModel={outer}>
          <span data-bind="text: outerLabel" />
          {showInner ? (
            <Host viewModel={inner}>
              <span data-bind="text: innerLabel" />
            </Host>
          ) : null}
        </Host>
      )
    }

    const { rerender, container } = render(<Harness showInner />)
    expect(inner.innerLabel.getSubscriptionsCount()).toBeGreaterThan(0)

    rerender(<Harness showInner={false} />)

    expect(container.textContent).toBe('outer')
    expect(inner.innerLabel.getSubscriptionsCount()).toBe(0)
  })

  it('rebinds an inner root when the outer view model is replaced', () => {
    const first = { outerLabel: ko.observable('first') }
    const second = { outerLabel: ko.observable('second') }
    const inner = { innerLabel: ko.observable('inner') }

    function Harness({ replaced }: { replaced: boolean }) {
      return (
        <Host viewModel={replaced ? second : first}>
          <span data-testid="outer" data-bind="text: outerLabel" />
          <Host viewModel={inner}>
            <span data-testid="inner" data-bind="text: innerLabel" />
          </Host>
        </Host>
      )
    }

    const { rerender } = render(<Harness replaced={false} />)
    expect(screen.getByTestId('outer').textContent).toBe('first')

    rerender(<Harness replaced />)

    expect(screen.getByTestId('outer').textContent).toBe('second')
    act(() => inner.innerLabel('inner changed'))
    expect(screen.getByTestId('inner').textContent).toBe('inner changed')
  })
})
