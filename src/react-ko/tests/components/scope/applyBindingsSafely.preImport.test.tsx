import { render } from '@testing-library/react'
import ko from 'knockout'
import { expect, it, vi } from 'vitest'

it('rejects a built-in handler replaced before react-ko is imported', async () => {
  const registered = ko.bindingHandlers.visible
  const update = vi.fn((element: Element) => {
    element.replaceChildren('Knockout replacement')
  })
  ko.bindingHandlers.visible = { update }

  try {
    vi.resetModules()
    const { applyBindingsSafely } = await import(
      '@/components/scope/applyBindingsSafely'
    )
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
    ko.bindingHandlers.visible = registered
    vi.resetModules()
  }
})
