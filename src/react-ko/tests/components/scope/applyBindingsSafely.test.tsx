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

  it('rejects an audited handler whose update method was mutated in place', () => {
    const handler = ko.bindingHandlers.visible
    const registeredUpdate = handler.update
    const update = vi.fn((element: Element) => {
      element.replaceChildren('Knockout replacement')
    })
    handler.update = update

    try {
      const { container } = render(
        <div data-bind="visible: shown">
          <span>React child</span>
        </div>
      )

      expect(() => applyBindingsSafely({ shown: true }, container)).toThrow(
        'react-ko cannot apply the Knockout "visible" binding'
      )
      expect(update).not.toHaveBeenCalled()
      expect(container.querySelector('span')?.textContent).toBe('React child')
    } finally {
      handler.update = registeredUpdate
    }
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

  it('rejects a registered handler using a Bubble option name', () => {
    const registered = ko.bindingHandlers.clickBubble
    const update = vi.fn((element: Element) => {
      element.replaceChildren('Knockout replacement')
    })
    ko.bindingHandlers.clickBubble = { update }

    try {
      const { container } = render(
        <button data-bind="click: handle, clickBubble: false">
          <span>React child</span>
        </button>
      )

      expect(() => applyBindingsSafely({ handle: vi.fn() }, container)).toThrow(
        'react-ko cannot apply the Knockout "clickBubble" binding'
      )
      expect(update).not.toHaveBeenCalled()
    } finally {
      if (registered === undefined) delete ko.bindingHandlers.clickBubble
      else ko.bindingHandlers.clickBubble = registered
    }
  })

  it.each(['optionsText', 'visible'])(
    'rejects a custom handler colliding with the allowlisted %s name',
    (binding) => {
      const registered = ko.bindingHandlers[binding]
      const init = vi.fn((element: Element) => {
        element.replaceChildren('Knockout replacement')
      })
      ko.bindingHandlers[binding] = { init }

      try {
        const { container } = render(
          <div data-bind={`${binding}: true`}>
            <span>React child</span>
          </div>
        )

        expect(() => applyBindingsSafely({}, container)).toThrow(
          `react-ko cannot apply the Knockout "${binding}" binding`
        )
        expect(init).not.toHaveBeenCalled()
        expect(container.querySelector('span')?.textContent).toBe('React child')
      } finally {
        if (registered === undefined) delete ko.bindingHandlers[binding]
        else ko.bindingHandlers[binding] = registered
      }
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

  it('rejects a custom binding that controls descendants before its handler runs', () => {
    const binding = 'customDescendantController'
    const init = vi.fn(() => ({ controlsDescendantBindings: true }))
    ko.bindingHandlers[binding] = { init }

    try {
      const { container } = render(
        <div data-bind={`${binding}: true`}>
          <span>React child</span>
        </div>
      )

      expect(() => applyBindingsSafely({}, container)).toThrow(
        `react-ko cannot apply the Knockout "${binding}" binding`
      )
      expect(init).not.toHaveBeenCalled()
      expect(container.querySelector('span')?.textContent).toBe('React child')
    } finally {
      delete ko.bindingHandlers[binding]
    }
  })

  it('keeps later React renders live after rejecting a custom child-replacement binding', () => {
    const binding = 'customChildReplacement'
    const init = vi.fn((element: Element) => {
      element.replaceChildren(document.createTextNode('Knockout replacement'))
    })
    ko.bindingHandlers[binding] = { init }

    function Child({ label }: { label: string }) {
      return <span>{label}</span>
    }

    try {
      const { container, rerender } = render(
        <div data-bind={`${binding}: true`}>
          <Child label="First render" />
        </div>
      )

      expect(() => applyBindingsSafely({}, container)).toThrow(
        `react-ko cannot apply the Knockout "${binding}" binding`
      )
      expect(init).not.toHaveBeenCalled()

      rerender(
        <div data-bind={`${binding}: true`}>
          <Child label="Second render" />
        </div>
      )

      expect(container.querySelector('span')?.textContent).toBe('Second render')
    } finally {
      delete ko.bindingHandlers[binding]
    }
  })

  it('allows a descendant-mutating binding when its element has no children', () => {
    const container = document.createElement('div')
    container.innerHTML = '<span data-bind="text: label"></span>'

    expect(() => applyBindingsSafely({ label: 'Knockout label' }, container)).not.toThrow()
    expect(container.querySelector('span')?.textContent).toBe('Knockout label')
  })
})
