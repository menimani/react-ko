import { describe, it, expect, vi } from 'vitest'
import ko from 'knockout'
import { DESCENDANT_BINDING_BOUNDARY } from '@/components/scope/descendantBindingBoundary'

describe('descendantBindingBoundary', () => {
  it('keeps the existing knockout handler when the module loads again', async () => {
    const registered = ko.bindingHandlers[DESCENDANT_BINDING_BOUNDARY]
    expect(registered).toBeDefined()

    vi.resetModules()
    await import('@/components/scope/descendantBindingBoundary')

    expect(ko.bindingHandlers[DESCENDANT_BINDING_BOUNDARY]).toBe(registered)
  })

  it('rejects an unrelated handler registered under the boundary name', async () => {
    const registered = ko.bindingHandlers[DESCENDANT_BINDING_BOUNDARY]
    ko.bindingHandlers[DESCENDANT_BINDING_BOUNDARY] = { init: () => undefined }

    try {
      vi.resetModules()
      await expect(
        import('@/components/scope/descendantBindingBoundary'),
      ).rejects.toThrow(
        `react-ko cannot register the "${DESCENDANT_BINDING_BOUNDARY}" Knockout binding because that name is already registered by another handler.`,
      )
    } finally {
      ko.bindingHandlers[DESCENDANT_BINDING_BOUNDARY] = registered
    }
  })
})
