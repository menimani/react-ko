import { createRequire } from 'node:module'
import { render } from '@testing-library/react'
import ko from 'knockout'
import { expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)

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
    expect(hasCanonicalKnockoutBindingHandler('visible')).toBe(true)
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
