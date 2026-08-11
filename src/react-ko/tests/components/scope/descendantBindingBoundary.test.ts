import { describe, it, expect, vi } from 'vitest'
import ko from 'knockout'
import {
  DESCENDANT_BINDING_BOUNDARY,
  ensureDescendantBindingBoundary,
} from '@/components/scope/descendantBindingBoundary'

describe('descendantBindingBoundary', () => {
  it('keeps the existing knockout handler when bindings are initialized again', async () => {
    ensureDescendantBindingBoundary()
    const registered = ko.bindingHandlers[DESCENDANT_BINDING_BOUNDARY]
    expect(registered).toBeDefined()

    vi.resetModules()
    const reloaded = await import('@/components/scope/descendantBindingBoundary')
    reloaded.ensureDescendantBindingBoundary()

    expect(ko.bindingHandlers[DESCENDANT_BINDING_BOUNDARY]).toBe(registered)
  })

  it('allows the public package to load before rejecting a boundary collision on use', async () => {
    const registered = ko.bindingHandlers[DESCENDANT_BINDING_BOUNDARY]
    const consumerHandler = { init: () => undefined }
    ko.bindingHandlers[DESCENDANT_BINDING_BOUNDARY] = consumerHandler

    try {
      vi.resetModules()
      await expect(import('@/index')).resolves.toBeDefined()
      expect(ko.bindingHandlers[DESCENDANT_BINDING_BOUNDARY]).toBe(consumerHandler)

      const reloaded = await import('@/components/scope/descendantBindingBoundary')
      expect(() => reloaded.ensureDescendantBindingBoundary()).toThrow(
        `react-ko cannot register the "${DESCENDANT_BINDING_BOUNDARY}" Knockout binding because that name is already registered by another handler.`,
      )
    } finally {
      ko.bindingHandlers[DESCENDANT_BINDING_BOUNDARY] = registered
    }
  })
})
