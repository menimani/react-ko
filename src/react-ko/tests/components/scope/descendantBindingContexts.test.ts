import { describe, it, expect, vi } from 'vitest'
import ko from 'knockout'
import '@/components/scope/descendantBindingContexts'

const CAPTURE_DESCENDANT_CONTEXT = 'reactKoCaptureDescendantContext'

describe('descendantBindingContexts', () => {
  it('tolerates binding a detached marker element directly through knockout', () => {
    const marker = document.createElement('div')
    marker.setAttribute('data-bind', `${CAPTURE_DESCENDANT_CONTEXT}: true`)
    expect(marker.parentNode).toBeNull()

    // The handler is registered globally, so nothing stops a knockout caller
    // from binding a parentless marker outside the library's own flow.
    expect(() => ko.applyBindings({}, marker)).not.toThrow()

    ko.cleanNode(marker)
  })

  it('keeps the existing knockout handler when the module loads again', async () => {
    const registered = ko.bindingHandlers[CAPTURE_DESCENDANT_CONTEXT]
    expect(registered).toBeDefined()

    vi.resetModules()
    await import('@/components/scope/descendantBindingContexts')

    expect(ko.bindingHandlers[CAPTURE_DESCENDANT_CONTEXT]).toBe(registered)
  })
})
