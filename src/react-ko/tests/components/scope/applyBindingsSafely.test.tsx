import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import ko from 'knockout'
import { applyBindingsSafely } from '@/components/scope/applyBindingsSafely'

describe('applyBindingsSafely', () => {
  it('rejects an unsafe if binding before it replaces React-owned children', () => {
    const handleClick = vi.fn()
    const visible = ko.observable(true)
    const { container } = render(
      <div data-bind="if: visible">
        <button onClick={handleClick}>React button</button>
      </div>
    )
    const button = container.querySelector('button')!

    expect(() => applyBindingsSafely({ visible }, container)).toThrow(
      'react-ko cannot apply the Knockout "if" binding'
    )
    expect(container.querySelector('button')).toBe(button)
    expect(visible.getSubscriptionsCount()).toBe(0)

    fireEvent.click(button)
    expect(handleClick).toHaveBeenCalledOnce()
  })

  it.each(['if', 'ifnot', 'foreach', 'template', 'with'])(
    'rejects the %s structural binding',
    (binding) => {
      const container = document.createElement('div')
      container.innerHTML = `<section data-bind="${binding}: value"><span>Child</span></section>`

      expect(() => applyBindingsSafely({ value: true }, container)).toThrow(
        `react-ko cannot apply the Knockout "${binding}" binding`
      )
      expect(container.querySelector('span')?.textContent).toBe('Child')
    }
  )

  it.each(['text', 'html', 'component', 'options'])(
    'rejects the %s binding when its element already has a React-owned child',
    (binding) => {
      const { container } = render(
        <div data-bind={`${binding}: value`}>
          <span>React child</span>
        </div>
      )

      expect(() => applyBindingsSafely({ value: 'Knockout value' }, container)).toThrow(
        `react-ko cannot apply the Knockout "${binding}" binding`
      )
      expect(container.querySelector('span')?.textContent).toBe('React child')
    }
  )

  it('leaves the React tree attached for later rerenders after rejecting a descendant-mutating binding', () => {
    const label = ko.observable('Knockout label')
    const handleClick = vi.fn()

    function Child({ text }: { text: string }) {
      return <button onClick={handleClick}>{text}</button>
    }

    const { container, rerender } = render(
      <div data-bind="text: label">
        <Child text="First render" />
      </div>
    )

    expect(() => applyBindingsSafely({ label }, container)).toThrow(
      'react-ko cannot apply the Knockout "text" binding'
    )

    rerender(
      <div data-bind="text: label">
        <Child text="Second render" />
      </div>
    )

    const button = container.querySelector('button')!
    expect(button.textContent).toBe('Second render')
    fireEvent.click(button)
    expect(handleClick).toHaveBeenCalledOnce()
  })

  it('leaves the React tree attached for unmount after rejecting a descendant-mutating binding', () => {
    const cleanup = vi.fn()

    function Child() {
      return (
        <span
          ref={(node) => {
            cleanup(node)
          }}
        >
          React child
        </span>
      )
    }

    const { container, unmount } = render(
      <div data-bind="html: markup">
        <Child />
      </div>
    )

    expect(() => applyBindingsSafely({ markup: '<b>Knockout</b>' }, container)).toThrow(
      'react-ko cannot apply the Knockout "html" binding'
    )
    expect(() => unmount()).not.toThrow()
    expect(cleanup).toHaveBeenLastCalledWith(null)
  })

  it('allows a descendant-mutating binding when its element has no children', () => {
    const container = document.createElement('div')
    container.innerHTML = '<span data-bind="text: label"></span>'

    expect(() => applyBindingsSafely({ label: 'Knockout label' }, container)).not.toThrow()
    expect(container.querySelector('span')?.textContent).toBe('Knockout label')
  })

  it('does not scan through a nested scope boundary', () => {
    const container = document.createElement('div')
    container.innerHTML = `
      <section data-bind="reactKoScopeBoundary: true">
        <div data-bind="if: visible"><span>Nested child</span></div>
      </section>
    `

    expect(() => applyBindingsSafely({}, container)).not.toThrow()
  })
})
