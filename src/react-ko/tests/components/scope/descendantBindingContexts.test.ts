import { describe, it, expect, vi } from 'vitest'
import ko from 'knockout'
import { prepareDescendantBindingContextCapture } from '@/components/scope/descendantBindingContexts'

const CAPTURE_DESCENDANT_CONTEXT = 'reactKoCaptureDescendantContext'

describe('descendantBindingContexts', () => {
  it('tolerates binding a detached marker element directly through knockout', () => {
    const marker = document.createElement('div')
    marker.setAttribute('data-bind', `${CAPTURE_DESCENDANT_CONTEXT}: true`)
    expect(marker.parentNode).toBeNull()

    const removeMarkers = prepareDescendantBindingContextCapture(marker)
    // The handler is registered globally, so nothing stops a knockout caller
    // from binding a parentless marker outside the library's own flow.
    expect(() => ko.applyBindings({}, marker)).not.toThrow()

    removeMarkers()
    ko.cleanNode(marker)
  })

  it('keeps the existing knockout handler when context capture is initialized again', async () => {
    const registrationRoot = document.createElement('div')
    prepareDescendantBindingContextCapture(registrationRoot)()
    const registered = ko.bindingHandlers[CAPTURE_DESCENDANT_CONTEXT]
    expect(registered).toBeDefined()

    vi.resetModules()
    const reloaded = await import('@/components/scope/descendantBindingContexts')

    expect(ko.bindingHandlers[CAPTURE_DESCENDANT_CONTEXT]).toBe(registered)

    const root = document.createElement('div')
    const usingElement = document.createElement('div')
    usingElement.setAttribute('data-bind', 'using: child')
    root.appendChild(usingElement)

    const removeMarkers = reloaded.prepareDescendantBindingContextCapture(root)
    const child = { name: 'captured child' }
    ko.applyBindings({ child }, root)

    const lateDescendant = document.createElement('span')
    usingElement.appendChild(lateDescendant)

    expect(reloaded.descendantBindingContextFor(lateDescendant, root)?.$data).toBe(child)

    removeMarkers()
    ko.cleanNode(root)
  })

  it('allows the public package to load before rejecting a capture collision on use', async () => {
    const registered = ko.bindingHandlers[CAPTURE_DESCENDANT_CONTEXT]
    const consumerHandler = { init: () => undefined }
    ko.bindingHandlers[CAPTURE_DESCENDANT_CONTEXT] = consumerHandler

    try {
      vi.resetModules()
      await expect(import('@/index')).resolves.toBeDefined()
      expect(ko.bindingHandlers[CAPTURE_DESCENDANT_CONTEXT]).toBe(consumerHandler)

      const reloaded = await import('@/components/scope/descendantBindingContexts')
      expect(() =>
        reloaded.prepareDescendantBindingContextCapture(
          document.createElement('div'),
        ),
      ).toThrow(
        `react-ko cannot register the "${CAPTURE_DESCENDANT_CONTEXT}" Knockout binding because that name is already registered by another handler.`,
      )
    } finally {
      ko.bindingHandlers[CAPTURE_DESCENDANT_CONTEXT] = registered
    }
  })
})
