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
