import { describe, it, expect } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import ko from 'knockout'
import { KnockoutScope } from '@/index'

describe('binding root order', () => {
  it('binds a root inside another root', () => {
    const outer = { outerLabel: ko.observable('outer') }
    const inner = { innerLabel: ko.observable('inner') }

    const { container } = render(
      <KnockoutScope viewModel={outer}>
        <span data-bind="text: outerLabel" />
        <KnockoutScope viewModel={inner}>
          <span data-bind="text: innerLabel" />
        </KnockoutScope>
      </KnockoutScope>
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
    'binds and disposes an inner scope nested in a %s scope',
    (outerViewModel) => {
      const inner = { label: ko.observable('inner') }

      const { container, unmount } = render(
        <KnockoutScope viewModel={outerViewModel}>
          <span data-testid="outer" />
          <KnockoutScope viewModel={inner}>
            <span data-bind="text: label" />
          </KnockoutScope>
        </KnockoutScope>
      )

      expect(ko.contextFor(screen.getByTestId('outer'))).toBeDefined()
      expect(container.textContent).toBe('inner')
      expect(inner.label.getSubscriptionsCount()).toBeGreaterThan(0)

      act(() => inner.label('inner changed'))
      expect(container.textContent).toBe('inner changed')

      unmount()
      expect(inner.label.getSubscriptionsCount()).toBe(0)
    }
  )

  it.each([null, undefined])(
    'keeps an inner scope live when its outer scope receives %s',
    (outerViewModel) => {
      const first = { name: 'first' }
      const second = { name: 'second' }
      const inner = { label: ko.observable('inner') }

      function Harness({
        outer,
      }: {
        outer: typeof first | typeof second | null | undefined
      }) {
        return (
          <KnockoutScope viewModel={outer}>
            <span data-testid="outer" />
            <KnockoutScope viewModel={inner}>
              <span data-testid="inner" data-bind="text: label" />
            </KnockoutScope>
          </KnockoutScope>
        )
      }

      const { rerender } = render(<Harness outer={first} />)
      expect(ko.dataFor(screen.getByTestId('outer'))).toBe(first)
      expect(screen.getByTestId('inner').textContent).toBe('inner')

      rerender(<Harness outer={outerViewModel} />)
      expect(ko.dataFor(screen.getByTestId('outer'))).toBe(outerViewModel)
      expect(ko.dataFor(screen.getByTestId('inner'))).toBe(inner)

      act(() => inner.label('inner while nullish'))
      expect(screen.getByTestId('inner').textContent).toBe(
        'inner while nullish'
      )

      rerender(<Harness outer={second} />)
      expect(ko.dataFor(screen.getByTestId('outer'))).toBe(second)

      act(() => inner.label('inner after replacement'))
      expect(screen.getByTestId('inner').textContent).toBe(
        'inner after replacement'
      )
    }
  )

  it('binds every level of a three-deep nest', () => {
    const a = { a: ko.observable('A') }
    const b = { b: ko.observable('B') }
    const c = { c: ko.observable('C') }

    const { container } = render(
      <KnockoutScope viewModel={a}>
        <span data-bind="text: a" />
        <KnockoutScope viewModel={b}>
          <span data-bind="text: b" />
          <KnockoutScope viewModel={c}>
            <span data-bind="text: c" />
          </KnockoutScope>
        </KnockoutScope>
      </KnockoutScope>
    )

    expect(container.textContent).toBe('ABC')
  })

  it('binds sibling roots and the root nested inside one of them', () => {
    const outer = { outer: ko.observable('outer') }
    const left = { left: ko.observable('left') }
    const right = { right: ko.observable('right') }
    const deep = { deep: ko.observable('deep') }

    const { container } = render(
      <KnockoutScope viewModel={outer}>
        <span data-bind="text: outer" />
        <KnockoutScope viewModel={left}>
          <span data-bind="text: left" />
          <KnockoutScope viewModel={deep}>
            <span data-bind="text: deep" />
          </KnockoutScope>
        </KnockoutScope>
        <KnockoutScope viewModel={right}>
          <span data-bind="text: right" />
        </KnockoutScope>
      </KnockoutScope>
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
      <KnockoutScope viewModel={outer}>
        <span data-testid="outer" />
        <KnockoutScope viewModel={inner}>
          <span data-testid="value" data-bind="text: label" />
        </KnockoutScope>
      </KnockoutScope>
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
        <KnockoutScope viewModel={outer}>
          <span data-bind="text: outerLabel" />
          {showInner ? (
            <KnockoutScope viewModel={inner}>
              <span data-testid="inner" data-bind="text: innerLabel" />
            </KnockoutScope>
          ) : null}
        </KnockoutScope>
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
        <KnockoutScope viewModel={outer}>
          <span data-bind="text: outerLabel" />
          {showInner ? (
            <KnockoutScope viewModel={inner}>
              <span data-bind="text: innerLabel" />
            </KnockoutScope>
          ) : null}
        </KnockoutScope>
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
        <KnockoutScope viewModel={replaced ? second : first}>
          <span data-testid="outer" data-bind="text: outerLabel" />
          <KnockoutScope viewModel={inner}>
            <span data-testid="inner" data-bind="text: innerLabel" />
          </KnockoutScope>
        </KnockoutScope>
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
