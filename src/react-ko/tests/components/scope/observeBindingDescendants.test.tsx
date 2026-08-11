import { describe, it, expect } from 'vitest'
import { render, screen, act, waitFor } from '@testing-library/react'
import { Component, type ReactNode, useState } from 'react'
import ko from 'knockout'
import { RootKnockoutProvider, KnockoutScope } from '@/index'

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? <span>Binding failed</span> : this.props.children
  }
}

function Host({ vm }: { vm: unknown }) {
  return (
    <RootKnockoutProvider viewModel={{}}>
      <KnockoutScope viewModel={vm}>
        <div data-testid="host" />
      </KnockoutScope>
    </RootKnockoutProvider>
  )
}

function LocalClassBinding({ vm }: { vm: unknown }) {
  const [className, setClassName] = useState('react-initial')
  const [bound, setBound] = useState(true)

  return (
    <RootKnockoutProvider viewModel={vm}>
      <>
        <span
          data-testid="class-owner"
          className={className}
          data-bind={bound ? 'class: activeClass' : undefined}
        />
        <button onClick={() => setClassName('react-updated')}>Update class</button>
        <button onClick={() => setBound(false)}>Retire class</button>
      </>
    </RootKnockoutProvider>
  )
}

function LocalVisibilityBinding({ binding, vm }: { binding: 'visible' | 'hidden'; vm: unknown }) {
  const [display, setDisplay] = useState('inline')
  const [bound, setBound] = useState(true)

  return (
    <RootKnockoutProvider viewModel={vm}>
      <>
        <span
          data-testid={`${binding}-owner`}
          style={{ display }}
          data-bind={bound ? `${binding}: concealed` : undefined}
        />
        <button onClick={() => setDisplay('flex')}>Update {binding} display</button>
        <button onClick={() => setBound(false)}>Retire {binding}</button>
      </>
    </RootKnockoutProvider>
  )
}

describe('observeBindingDescendants', () => {
  it('reapplies a class binding after a local React className update and retires it safely', async () => {
    render(<LocalClassBinding vm={{ activeClass: ko.observable('ko-active') }} />)
    const owner = screen.getByTestId('class-owner')
    expect(owner.className).toBe('react-initial ko-active')

    act(() => screen.getByText('Update class').click())
    await waitFor(() => expect(owner.className).toBe('react-updated ko-active'))

    act(() => screen.getByText('Retire class').click())
    await waitFor(() => expect(owner.className).toBe('react-updated'))
  })

  for (const binding of ['visible', 'hidden'] as const) {
    it(`reapplies and safely retires a ${binding} binding after a local React display update`, async () => {
      const concealed = binding === 'visible' ? false : true
      render(<LocalVisibilityBinding binding={binding} vm={{ concealed }} />)
      const owner = screen.getByTestId(`${binding}-owner`)
      expect(owner.style.display).toBe('none')

      act(() => screen.getByText(`Update ${binding} display`).click())
      await waitFor(() => expect(owner.style.display).toBe('none'))

      act(() => screen.getByText(`Retire ${binding}`).click())
      await waitFor(() => expect(owner.style.display).toBe('flex'))
    })
  }

  it('leaves html binding descendants unbound after observable updates', async () => {
    const vm = {
      label: 'Bound unexpectedly',
      markup: ko.observable('<span data-bind="text: label">Initial markup</span>'),
    }
    render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <div data-testid="html-owner" data-bind="html: markup" />
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    const owner = screen.getByTestId('html-owner')
    expect(owner.textContent).toBe('Initial markup')

    act(() => {
      vm.markup('<span data-bind="text: label">Updated markup</span>')
    })

    await waitFor(() => expect(owner.textContent).toBe('Updated markup'))
  })

  it('degrades to a no-op observer in a document without a window', async () => {
    const detached = document.implementation.createHTMLDocument('detached')
    expect(detached.defaultView).toBeNull()

    const { prepareBindingDescendants, observeBindingDescendants } = await import(
      '@/components/scope/observeBindingDescendants'
    )
    const root = detached.createElement('div')
    detached.body.appendChild(root)

    const errors: unknown[] = []
    const stop = observeBindingDescendants(
      {},
      root,
      (error) => errors.push(error),
      prepareBindingDescendants(root)
    )

    root.appendChild(detached.createElement('span'))
    stop()

    expect(errors).toEqual([])
  })

  it('surfaces a binding error raised by a late non-React descendant of a scope', async () => {
    render(
      <ErrorBoundary>
        <Host vm={{}} />
      </ErrorBoundary>
    )
    const host = screen.getByTestId('host')

    const el = document.createElement('span')
    el.setAttribute('data-bind', 'text: missing.value')
    act(() => {
      host.appendChild(el)
    })

    await waitFor(() => expect(screen.getByText('Binding failed')).toBeDefined())
  })

  it('binds nodes added through insertBefore', async () => {
    const vm = { label: ko.observable('Inserted') }
    render(<Host vm={vm} />)
    const host = screen.getByTestId('host')

    const el = document.createElement('span')
    el.setAttribute('data-bind', 'text: label')
    act(() => {
      host.insertBefore(el, host.firstChild)
    })

    await waitFor(() => expect(screen.getByText('Inserted')).toBeDefined())
  })

  it('disposes a late-bound child removed in the same batch as unmount', async () => {
    const vm = { label: ko.observable('Late') }
    const { unmount } = render(<Host vm={vm} />)
    const host = screen.getByTestId('host')
    const child = document.createElement('span')
    child.setAttribute('data-bind', 'text: label')

    act(() => {
      host.appendChild(child)
    })
    await waitFor(() => expect(vm.label.getSubscriptionsCount()).toBe(1))

    act(() => {
      child.remove()
      unmount()
    })

    expect(vm.label.getSubscriptionsCount()).toBe(0)
  })

  it('binds nodes added through replaceChild', async () => {
    const vm = { label: ko.observable('Replaced') }
    render(<Host vm={vm} />)
    const host = screen.getByTestId('host')

    const placeholder = document.createElement('span')
    const el = document.createElement('span')
    el.setAttribute('data-bind', 'text: label')
    act(() => {
      host.appendChild(placeholder)
      host.replaceChild(el, placeholder)
    })

    await waitFor(() => expect(screen.getByText('Replaced')).toBeDefined())
  })

  it('binds a non-React subtree whose ownership is unknown', async () => {
    const vm = { on: ko.observable(true) }
    render(<Host vm={vm} />)
    const host = screen.getByTestId('host')

    const el = document.createElement('span')
    el.setAttribute('data-bind', 'css: { flagged: on }')
    el.appendChild(document.createElement('em'))
    act(() => {
      host.appendChild(el)
    })

    await waitFor(() => expect(el.classList.contains('flagged')).toBe(true))
  })

  it('restores prototype interceptors only after the last root unmounts', () => {
    const originalAppendChild = Node.prototype.appendChild
    const originalValueSetter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      'value'
    )?.set
    const first = render(<Host vm={{}} />)
    const second = render(<Host vm={{}} />)
    expect(Node.prototype.appendChild).not.toBe(originalAppendChild)
    expect(Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set).not.toBe(
      originalValueSetter
    )

    first.unmount()
    expect(Node.prototype.appendChild).not.toBe(originalAppendChild)

    second.unmount()
    expect(Node.prototype.appendChild).toBe(originalAppendChild)
    expect(Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set).toBe(
      originalValueSetter
    )
  })

  it('retires css classes owned by a replaced binding', async () => {
    const vm = { flag: ko.observable(true) }
    render(<Host vm={vm} />)
    const host = screen.getByTestId('host')

    const el = document.createElement('span')
    el.setAttribute('data-bind', 'css: { first: flag }')
    act(() => {
      host.appendChild(el)
    })
    await waitFor(() => expect(el.classList.contains('first')).toBe(true))

    act(() => {
      el.setAttribute('data-bind', 'css: { second: flag }')
    })

    await waitFor(() => {
      expect(el.classList.contains('second')).toBe(true)
      expect(el.classList.contains('first')).toBe(false)
    })
  })

  it('restores visibility when a visible binding is replaced', async () => {
    const vm = { hidden: ko.observable(false), label: ko.observable('Shown') }
    render(<Host vm={vm} />)
    const host = screen.getByTestId('host')

    const el = document.createElement('span')
    el.setAttribute('data-bind', 'visible: hidden')
    act(() => {
      host.appendChild(el)
    })
    await waitFor(() => expect(el.style.display).toBe('none'))

    act(() => {
      el.setAttribute('data-bind', 'text: label')
    })

    await waitFor(() => {
      expect(el.style.display).not.toBe('none')
      expect(el.textContent).toBe('Shown')
    })
  })

  it('restores checked and disabled state when their bindings are replaced', async () => {
    const vm = {
      checked: ko.observable(true),
      enabled: ko.observable(false),
      title: ko.observable('after')
    }
    render(<Host vm={vm} />)
    const host = screen.getByTestId('host')

    const el = document.createElement('input')
    el.type = 'checkbox'
    el.setAttribute('data-bind', 'checked: checked, enable: enabled')
    act(() => {
      host.appendChild(el)
    })
    await waitFor(() => {
      expect(el.checked).toBe(true)
      expect(el.disabled).toBe(true)
    })

    act(() => {
      el.setAttribute('data-bind', 'attr: { title: title }')
    })

    await waitFor(() => {
      expect(el.checked).toBe(false)
      expect(el.disabled).toBe(false)
      expect(el.getAttribute('title')).toBe('after')
    })
  })

  it('removes attributes owned by a replaced attr binding', async () => {
    const vm = { title: ko.observable('owned'), label: ko.observable('Plain') }
    render(<Host vm={vm} />)
    const host = screen.getByTestId('host')

    const el = document.createElement('span')
    el.setAttribute('data-bind', 'attr: { title: title }')
    act(() => {
      host.appendChild(el)
    })
    await waitFor(() => expect(el.getAttribute('title')).toBe('owned'))

    act(() => {
      el.setAttribute('data-bind', 'text: label')
    })

    await waitFor(() => {
      expect(el.getAttribute('title')).toBeNull()
      expect(el.textContent).toBe('Plain')
    })
  })

  it.each([
    ['class', 'class', 'knockout-class'],
    ['style', 'style', 'color: red;'],
  ] as const)(
    'restores the %s attribute owned by a retired attr binding',
    async (attribute, bindingKey, knockoutValue) => {
      const vm = { value: ko.observable(knockoutValue) }
      render(<Host vm={vm} />)
      const host = screen.getByTestId('host')

      const el = document.createElement('span')
      el.setAttribute(attribute, attribute === 'class' ? 'react-class' : 'color: blue;')
      el.setAttribute('data-bind', `attr: { ${bindingKey}: value }`)
      act(() => {
        host.appendChild(el)
      })
      await waitFor(() => expect(el.getAttribute(attribute)).toBe(knockoutValue))

      act(() => {
        el.removeAttribute('data-bind')
      })

      await waitFor(() => {
        expect(el.getAttribute(attribute)).toBe(
          attribute === 'class' ? 'react-class' : 'color: blue;'
        )
      })
    }
  )

  it('retires the textinput alias and restores the previous value', async () => {
    const vm = { value: ko.observable('Knockout') }
    render(<Host vm={vm} />)
    const host = screen.getByTestId('host')

    const el = document.createElement('input')
    el.value = 'Before binding'
    el.setAttribute('data-bind', 'textinput: value')
    act(() => {
      host.appendChild(el)
    })
    await waitFor(() => expect(el.value).toBe('Knockout'))

    act(() => {
      el.removeAttribute('data-bind')
    })

    await waitFor(() => expect(el.value).toBe('Before binding'))
  })

  it('retires a binding whose data-bind attribute is removed', async () => {
    const vm = { flag: ko.observable(true) }
    render(<Host vm={vm} />)
    const host = screen.getByTestId('host')

    const el = document.createElement('span')
    el.setAttribute('data-bind', 'css: { first: flag }')
    act(() => {
      host.appendChild(el)
    })
    await waitFor(() => expect(el.classList.contains('first')).toBe(true))

    act(() => {
      el.removeAttribute('data-bind')
    })

    await waitFor(() => expect(el.classList.contains('first')).toBe(false))
  })

  it('restores inline style owned by a replaced style binding', async () => {
    const vm = { color: ko.observable('red'), label: ko.observable('Styled') }
    render(<Host vm={vm} />)
    const host = screen.getByTestId('host')

    const el = document.createElement('span')
    el.setAttribute('data-bind', 'style: { color: color }')
    act(() => {
      host.appendChild(el)
    })
    await waitFor(() => expect(el.style.color).toBe('red'))

    act(() => {
      el.setAttribute('data-bind', 'text: label')
    })

    await waitFor(() => {
      expect(el.style.color).toBe('')
      expect(el.textContent).toBe('Styled')
    })
  })

  it('restores the name attribute owned by a replaced uniqueName binding', async () => {
    const vm = { label: ko.observable('Named') }
    render(<Host vm={vm} />)
    const host = screen.getByTestId('host')

    const el = document.createElement('input')
    el.setAttribute('data-bind', 'uniqueName: true')
    act(() => {
      host.appendChild(el)
    })
    await waitFor(() => expect(el.getAttribute('name')).not.toBeNull())

    act(() => {
      el.setAttribute('data-bind', 'attr: { title: label }')
    })

    await waitFor(() => expect(el.getAttribute('name')).toBeNull())
  })

  it('releases focus taken by a replaced hasFocus binding', async () => {
    const vm = { focused: ko.observable(true), label: ko.observable('Blurred') }
    render(<Host vm={vm} />)
    const host = screen.getByTestId('host')

    const el = document.createElement('input')
    el.setAttribute('data-bind', 'hasFocus: focused')
    act(() => {
      host.appendChild(el)
    })
    await waitFor(() => expect(document.activeElement).toBe(el))

    act(() => {
      el.setAttribute('data-bind', 'attr: { title: label }')
    })

    await waitFor(() => expect(document.activeElement).not.toBe(el))
  })
})
