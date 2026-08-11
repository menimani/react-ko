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

  it('runs a non-descendant custom init once on the live element', () => {
    const binding = 'initializedTooltip'
    const init = vi.fn((element: HTMLElement) => {
      element.title = 'Initialized tooltip'
    })
    ko.bindingHandlers[binding] = { init }

    try {
      const { container } = render(
        <button data-bind={`${binding}: true`}>
          <span>React child</span>
        </button>
      )
      const button = container.querySelector('button')!

      applyBindingsSafely({}, container)

      expect(init).toHaveBeenCalledOnce()
      expect(init.mock.calls[0][0]).toBe(button)
      expect(button.title).toBe('Initialized tooltip')
      expect(button.querySelector('span')?.textContent).toBe('React child')
    } finally {
      delete ko.bindingHandlers[binding]
    }
  })

  it('does not validate an unrelated subtree bound by a custom binding', () => {
    const binding = 'bindDetachedTree'
    const detached = document.createElement('div')
    detached.innerHTML =
      '<section data-bind="if: visible"><span>Detached child</span></section>'
    ko.bindingHandlers[binding] = {
      init() {
        ko.applyBindings({ visible: true }, detached)
      },
    }

    try {
      const { container } = render(<div data-bind={`${binding}: true`} />)

      expect(() => applyBindingsSafely({}, container)).not.toThrow()
      expect(detached.querySelector('span')?.textContent).toBe('Detached child')
    } finally {
      ko.cleanNode(detached)
      delete ko.bindingHandlers[binding]
    }
  })

  it.each(['if', 'ifnot', 'foreach', 'template', 'with', 'text', 'html'])(
    'rejects an unsafe %s binding injected by a custom preprocessor',
    (injectedBinding) => {
      const binding = 'unsafeAlias'
      const value = ko.observable(injectedBinding === 'foreach' ? [] : true)
      ko.bindingHandlers[binding] = {
        preprocess(expression, _name, addBinding) {
          addBinding(injectedBinding, expression)
        },
      }

      try {
        const { container } = render(
          <div data-bind={`${binding}: value`}>
            <span>React child</span>
          </div>
        )
        const child = container.querySelector('span')

        expect(() => applyBindingsSafely({ value }, container)).toThrow(
          `react-ko cannot apply the Knockout "${injectedBinding}" binding`
        )
        expect(container.querySelector('span')).toBe(child)
        expect(value.getSubscriptionsCount()).toBe(0)
      } finally {
        delete ko.bindingHandlers[binding]
      }
    }
  )

  it('runs a custom binding preprocessor once while applying its validated expression', () => {
    const binding = 'preprocessedTooltip'
    const preprocess = vi.fn((expression: string) => `{ title: ${expression} }`)
    ko.bindingHandlers[binding] = {
      preprocess,
      update(element, valueAccessor) {
        const value = ko.unwrap(valueAccessor()) as { title: string }
        element.setAttribute('title', value.title)
      },
    }

    try {
      const container = document.createElement('div')
      container.innerHTML = `<button data-bind="${binding}: label"></button>`

      applyBindingsSafely({ label: 'Validated tooltip' }, container)

      expect(preprocess).toHaveBeenCalledOnce()
      expect(container.querySelector('button')?.title).toBe('Validated tooltip')
    } finally {
      delete ko.bindingHandlers[binding]
    }
  })

  it('applies the safe result validated from a stateful alias preprocessor', () => {
    const binding = 'statefulAlias'
    const label = ko.observable('Knockout replacement')
    let preprocessCalls = 0
    ko.bindingHandlers[binding] = {
      preprocess(expression, _name, addBinding) {
        preprocessCalls += 1
        addBinding(preprocessCalls === 1 ? 'visible' : 'text', expression)
      },
    }

    try {
      const { container } = render(
        <div data-bind={`${binding}: label`}>
          <span>React child</span>
        </div>
      )
      const child = container.querySelector('span')

      applyBindingsSafely({ label }, container)

      expect(preprocessCalls).toBe(1)
      expect(container.querySelector('span')).toBe(child)
      expect(container.textContent).toBe('React child')

      label('')
      expect((container.firstElementChild as HTMLElement).style.display).toBe('none')
      expect(container.querySelector('span')).toBe(child)
    } finally {
      delete ko.bindingHandlers[binding]
    }
  })

  it('compiles and validates data-bind through a getBindings-only provider', () => {
    const provider = ko.bindingProvider.instance
    const getBindings = vi.fn((node: Node, context: ko.BindingContext) =>
      node.nodeType === Node.ELEMENT_NODE &&
      (node as Element).hasAttribute('data-bind')
        ? { attr: { title: context.$data.label } }
        : null
    )
    ko.bindingProvider.instance = {
      nodeHasBindings(node) {
        return (
          node.nodeType === Node.ELEMENT_NODE &&
          (node as Element).hasAttribute('data-bind')
        )
      },
      getBindings,
    } as ko.IBindingProvider

    try {
      const { container } = render(
        <button data-bind="text: label">
          <span>React child</span>
        </button>
      )

      applyBindingsSafely({ label: 'Provider tooltip' }, container)

      expect(getBindings).toHaveBeenCalled()
      expect(container.querySelector('button')?.title).toBe('Provider tooltip')
      expect(container.querySelector('span')?.textContent).toBe('React child')
    } finally {
      ko.bindingProvider.instance = provider
    }
  })

  it('restores custom binding provider method descriptors after applying bindings', () => {
    const originalProvider = ko.bindingProvider.instance
    const provider = Object.create(originalProvider) as ko.IBindingProvider & {
      getBindingsString: ko.bindingProvider['getBindingsString']
    }
    Object.defineProperties(provider, {
      getBindingAccessors: {
        configurable: false,
        enumerable: true,
        value: originalProvider.getBindingAccessors,
        writable: true,
      },
      getBindings: {
        configurable: true,
        enumerable: false,
        value: originalProvider.getBindings,
        writable: false,
      },
      getBindingsString: {
        configurable: false,
        enumerable: false,
        value: ko.bindingProvider.prototype.getBindingsString,
        writable: true,
      },
    })
    const originalDescriptors = Object.getOwnPropertyDescriptors(provider)
    ko.bindingProvider.instance = provider

    try {
      const container = document.createElement('div')
      container.innerHTML = '<button data-bind="attr: { title: label }"></button>'

      applyBindingsSafely({ label: 'Restored provider' }, container)

      expect(container.querySelector('button')?.title).toBe('Restored provider')
      for (const method of [
        'getBindingAccessors',
        'getBindings',
        'getBindingsString',
      ] as const) {
        expect(Object.getOwnPropertyDescriptor(provider, method)).toEqual(
          originalDescriptors[method]
        )
      }
    } finally {
      ko.bindingProvider.instance = originalProvider
    }
  })

  it.each(['getBindingAccessors', 'getBindings'] as const)(
    'validates through a provider with a read-only %s descriptor',
    (method) => {
      const originalProvider = ko.bindingProvider.instance
      const provider = Object.create(originalProvider) as ko.IBindingProvider
      if (method === 'getBindings') {
        Object.defineProperty(provider, 'getBindingAccessors', {
          configurable: true,
          value: undefined,
        })
      }
      Object.defineProperty(provider, method, {
        configurable: false,
        value: originalProvider[method],
        writable: false,
      })
      const descriptor = Object.getOwnPropertyDescriptor(provider, method)
      ko.bindingProvider.instance = provider

      try {
        const container = document.createElement('div')
        container.innerHTML = '<button data-bind="attr: { title: label }"></button>'

        expect(() =>
          applyBindingsSafely({ label: 'Read-only provider' }, container)
        ).not.toThrow()
        expect(container.querySelector('button')?.title).toBe('Read-only provider')
        expect(Object.getOwnPropertyDescriptor(provider, method)).toEqual(descriptor)
      } finally {
        ko.bindingProvider.instance = originalProvider
      }
    }
  )

  it('restores custom binding provider method descriptors when a binding throws', () => {
    const binding = 'throwingBinding'
    const originalProvider = ko.bindingProvider.instance
    const provider = Object.create(originalProvider) as ko.IBindingProvider & {
      getBindingsString: ko.bindingProvider['getBindingsString']
    }
    Object.defineProperties(provider, {
      getBindingAccessors: {
        configurable: false,
        enumerable: true,
        value: originalProvider.getBindingAccessors,
        writable: true,
      },
      getBindings: {
        configurable: true,
        enumerable: false,
        value: originalProvider.getBindings,
        writable: false,
      },
      getBindingsString: {
        configurable: false,
        enumerable: false,
        value: ko.bindingProvider.prototype.getBindingsString,
        writable: true,
      },
    })
    const originalDescriptors = Object.getOwnPropertyDescriptors(provider)
    ko.bindingProvider.instance = provider
    ko.bindingHandlers[binding] = {
      init() {
        throw new Error('Binding failed')
      },
    }

    try {
      const container = document.createElement('div')
      container.innerHTML = `<button data-bind="${binding}: true"></button>`

      expect(() => applyBindingsSafely({}, container)).toThrow('Binding failed')
      for (const method of [
        'getBindingAccessors',
        'getBindings',
        'getBindingsString',
      ] as const) {
        expect(Object.getOwnPropertyDescriptor(provider, method)).toEqual(
          originalDescriptors[method]
        )
      }
    } finally {
      delete ko.bindingHandlers[binding]
      ko.bindingProvider.instance = originalProvider
    }
  })

  it('rejects and cleans a custom handler that controls React-owned descendants', () => {
    const binding = 'customDescendantController'
    const label = ko.observable('Bound before failure')
    const dispose = vi.fn()
    const getBindingHandler = ko.getBindingHandler
    ko.bindingHandlers[binding] = {
      init(element) {
        ko.utils.domNodeDisposal.addDisposeCallback(element, dispose)
        return { controlsDescendantBindings: true }
      },
    }

    try {
      const { container } = render(
        <>
          <span data-bind="text: label" />
          <section data-bind={`${binding}: true`}>
            <span data-bind="attr: { title: nested }">React child</span>
          </section>
        </>
      )

      expect(() =>
        applyBindingsSafely({ label, nested: 'Knockout child' }, container)
      ).toThrow(
        `react-ko cannot apply the Knockout "${binding}" binding because its custom handler controls React-owned child nodes.`
      )
      expect(container.querySelector('section span')?.textContent).toBe('React child')
      expect(container.querySelector('section span')?.getAttribute('title')).toBeNull()
      expect(label.getSubscriptionsCount()).toBe(0)
      expect(dispose).toHaveBeenCalledOnce()
      expect(ko.getBindingHandler).toBe(getBindingHandler)
    } finally {
      delete ko.bindingHandlers[binding]
    }
  })

  it('restores React children removed by a rejected controlling custom init', () => {
    const binding = 'destructiveDescendantController'
    const init = vi.fn((element: Node) => {
      const auditTarget = element as Element
      auditTarget.replaceChildren()
      return { controlsDescendantBindings: true }
    })
    ko.bindingHandlers[binding] = {
      init,
    }

    try {
      const { container } = render(
        <section data-bind={`${binding}: true`}>
          <span>React child</span>
        </section>
      )
      const child = container.querySelector('span')

      expect(() => applyBindingsSafely({}, container)).toThrow(
        `react-ko cannot apply the Knockout "${binding}" binding because its custom handler controls React-owned child nodes.`
      )
      expect(container.querySelector('span')).toBe(child)
      expect(container.querySelector('span')?.textContent).toBe('React child')
      expect(init).toHaveBeenCalledOnce()
      expect(init.mock.calls[0][0]).toBe(container.querySelector('section'))
    } finally {
      delete ko.bindingHandlers[binding]
    }
  })

  it('restores a React-owned virtual range removed by a rejected custom init', () => {
    const binding = 'destructiveVirtualDescendantController'
    const init = vi.fn((start: Node) => {
      const children = ko.virtualElements.childNodes(start)
      const end = (children[children.length - 1] ?? start).nextSibling
      ko.virtualElements.emptyNode(start)
      end?.parentNode?.removeChild(end)
      return { controlsDescendantBindings: true }
    })
    ko.bindingHandlers[binding] = { init }
    ko.virtualElements.allowedBindings[binding] = true

    try {
      const { container } = render(
        <div
          dangerouslySetInnerHTML={{
            __html:
              `<!-- ko ${binding}: true -->` +
              '<span data-testid="virtual-child">React child</span>' +
              '<!-- /ko -->',
          }}
        />
      )
      const child = container.querySelector('[data-testid="virtual-child"]')
      const rangeParent = child?.parentNode
      const rangeNodes = [...(rangeParent?.childNodes ?? [])]
      const rangeStart = rangeNodes[0] as Comment

      expect(() => applyBindingsSafely({}, container)).toThrow(
        `react-ko cannot apply the Knockout "${binding}" binding because its custom handler controls React-owned child nodes.`
      )
      expect([...(rangeParent?.childNodes ?? [])]).toEqual(rangeNodes)
      expect(ko.virtualElements.childNodes(rangeStart)).toEqual([child])
      expect(container.querySelector('[data-testid="virtual-child"]')).toBe(child)
      expect(container.textContent).toBe('React child')
      expect(init).toHaveBeenCalledOnce()
      expect(init.mock.calls[0][0]).toBe(rangeStart)
    } finally {
      delete ko.virtualElements.allowedBindings[binding]
      delete ko.bindingHandlers[binding]
    }
  })

  it('rejects a controlling custom handler on an element from another realm', () => {
    const binding = 'crossRealmDescendantController'
    ko.bindingHandlers[binding] = {
      init() {
        return { controlsDescendantBindings: true }
      },
    }
    const iframe = document.createElement('iframe')
    document.body.append(iframe)

    try {
      const foreignDocument = iframe.contentDocument!
      const container = foreignDocument.createElement('div')
      container.innerHTML =
        `<section data-bind="${binding}: true"><span>React child</span></section>`
      foreignDocument.body.append(container)

      expect(() => applyBindingsSafely({}, container)).toThrow(
        `react-ko cannot apply the Knockout "${binding}" binding because its custom handler controls React-owned child nodes.`
      )
      expect(container.querySelector('span')?.textContent).toBe('React child')
    } finally {
      iframe.remove()
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
