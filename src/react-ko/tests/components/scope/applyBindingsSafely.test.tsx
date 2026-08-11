import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render } from '@testing-library/react'
import { version as reactVersion, type ReactNode } from 'react'
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

  it.each(['if', 'ifnot', 'foreach', 'template', 'with'])(
    'rejects a React-owned virtual %s binding',
    (binding) => {
      const markup = `<!-- ko ${binding}: value --><span>React markup</span><!-- /ko -->`
      const { container } = render(
        <div dangerouslySetInnerHTML={{ __html: markup }} />
      )

      expect(() => applyBindingsSafely({ value: true }, container)).toThrow(
        `react-ko cannot apply the Knockout "${binding}" binding because it controls React-owned child nodes. ` +
          'Use KoIf, KoIfNot, KoForeach, or KoWith instead.'
      )
      expect(container.querySelector('span')?.textContent).toBe('React markup')
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

  it('rejects a content binding over a direct React text node', () => {
    const { container } = render(<div data-bind="text: value">React text</div>)

    expect(() => applyBindingsSafely({ value: 'Knockout value' }, container)).toThrow(
      'react-ko cannot apply the Knockout "text" binding'
    )
    expect(container.textContent).toBe('React text')
  })

  it('rejects a content binding over a direct React number without detaching the tree', () => {
    const { container, rerender } = render(<div data-bind="text: value">{123}</div>)

    expect(() => applyBindingsSafely({ value: 'Knockout value' }, container)).toThrow(
      'react-ko cannot apply the Knockout "text" binding'
    )
    expect(container.textContent).toBe('123')

    rerender(<div data-bind="text: value">{456}</div>)
    expect(container.textContent).toBe('456')
  })

  it('handles direct React bigint content according to the React major', () => {
    const bigint = 123n as unknown as ReactNode
    const { container } = render(<div data-bind="text: value">{bigint}</div>)
    const apply = () => applyBindingsSafely({ value: 'Knockout value' }, container)

    if (Number.parseInt(reactVersion, 10) >= 19) {
      expect(apply).toThrow('react-ko cannot apply the Knockout "text" binding')
      expect(container.textContent).toBe('123')
    } else {
      expect(apply).not.toThrow()
      expect(container.textContent).toBe('Knockout value')
    }
  })

  it.each([
    ['class', 'className', 'active'],
    ['hidden', 'isHidden', true],
  ] as const)('allows the built-in %s binding with React-owned children', (binding, key, value) => {
    const { container } = render(
      <div data-bind={`${binding}: ${key}`}>
        <span>React child</span>
      </div>
    )

    expect(() => applyBindingsSafely({ [key]: value }, container)).not.toThrow()
    const element = container.firstElementChild as HTMLElement
    if (binding === 'class') expect(element.classList.contains('active')).toBe(true)
    else expect(element.style.display).toBe('none')
    expect(element.querySelector('span')?.textContent).toBe('React child')
  })

  it('allows a handlerless event Bubble option with React-owned children', () => {
    const handle = vi.fn()
    const { container } = render(
      <button data-bind="click: handle, clickBubble: false">
        <span>React child</span>
      </button>
    )

    expect(() => applyBindingsSafely({ handle }, container)).not.toThrow()
    fireEvent.click(container.querySelector('span')!)

    expect(handle).toHaveBeenCalledOnce()
    expect(container.querySelector('span')?.textContent).toBe('React child')
  })

  it('allows a non-descendant custom binding with React-owned children', () => {
    const binding = 'tooltip'
    const tooltip = ko.observable('Initial tooltip')
    ko.bindingHandlers[binding] = {
      update(element, valueAccessor) {
        element.setAttribute('title', ko.unwrap(valueAccessor()))
      },
    }

    try {
      const { container } = render(
        <button data-bind={`${binding}: tooltip`}>
          <span>React child</span>
        </button>
      )

      expect(() => applyBindingsSafely({ tooltip }, container)).not.toThrow()
      const button = container.querySelector('button')!
      expect(button.title).toBe('Initial tooltip')
      expect(button.querySelector('span')?.textContent).toBe('React child')

      tooltip('Updated tooltip')
      expect(button.title).toBe('Updated tooltip')
      expect(button.querySelector('span')?.textContent).toBe('React child')
    } finally {
      delete ko.bindingHandlers[binding]
    }
  })

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
})
