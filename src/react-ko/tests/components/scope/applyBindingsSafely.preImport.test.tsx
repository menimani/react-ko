import { createRequire } from 'node:module'
import { render } from '@testing-library/react'
import ko from 'knockout'
import { expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)

const canonicalDebugHandlerMethods = [
  ['attr', 'update'],
  ['checked', 'init'],
  ['checkedValue', 'update'],
  ['class', 'update'],
  ['click', 'init'],
  ['component', 'init'],
  ['css', 'update'],
  ['disable', 'update'],
  ['enable', 'update'],
  ['event', 'init'],
  ['hasFocus', 'init'],
  ['hasFocus', 'update'],
  ['hasfocus', 'init'],
  ['hasfocus', 'update'],
  ['hidden', 'update'],
  ['html', 'init'],
  ['html', 'update'],
  ['let', 'init'],
  ['options', 'init'],
  ['options', 'update'],
  ['selectedOptions', 'init'],
  ['selectedOptions', 'update'],
  ['style', 'update'],
  ['submit', 'init'],
  ['text', 'init'],
  ['text', 'update'],
  ['textInput', 'init'],
  ['textinput', 'preprocess'],
  ['uniqueName', 'init'],
  ['using', 'init'],
  ['value', 'init'],
  ['value', 'update'],
  ['visible', 'update'],
] as const

it('accepts unchanged built-in handlers from the official Knockout debug build', async () => {
  const debugKo = require(
    'knockout/build/output/knockout-latest.debug.js'
  ) as typeof ko

  try {
    vi.resetModules()
    vi.doMock('knockout', () => ({ default: debugKo }))
    const {
      applyBindingsSafely,
      hasCanonicalKnockoutBindingHandler,
    } = await import(
      '@/components/scope/applyBindingsSafely'
    )
    const { container } = render(
      <div data-bind="visible: shown">
        <span>React child</span>
      </div>
    )

    expect(() => applyBindingsSafely({ shown: true }, container)).not.toThrow()
    for (const [name, method] of canonicalDebugHandlerMethods) {
      expect(
        debugKo.bindingHandlers[name]?.[method],
        `${name}.${method} should exist in the debug build`
      ).toBeTypeOf('function')
      expect(
        hasCanonicalKnockoutBindingHandler(name),
        `${name}.${method} should match its debug-build fingerprint`
      ).toBe(true)
    }
    expect(container.querySelector('span')?.textContent).toBe('React child')
  } finally {
    vi.doUnmock('knockout')
    vi.resetModules()
  }
})

it('detects a same-arity built-in handler replaced before react-ko is imported', async () => {
  const registered = ko.bindingHandlers.visible
  ko.bindingHandlers.visible = {
    update(element, _valueAccessor) {
      element.setAttribute('title', 'custom effect')
    },
  }

  try {
    vi.resetModules()
    const {
      applyBindingsSafely,
      hasCanonicalKnockoutBindingHandler,
    } = await import(
      '@/components/scope/applyBindingsSafely'
    )
    const container = document.createElement('div')
    container.innerHTML = '<span data-bind="visible: shown"></span>'

    applyBindingsSafely({ shown: true }, container)

    expect(hasCanonicalKnockoutBindingHandler('visible')).toBe(false)
    expect(container.firstElementChild?.getAttribute('title')).toBe('custom effect')
  } finally {
    ko.bindingHandlers.visible = registered
    vi.resetModules()
  }
})
