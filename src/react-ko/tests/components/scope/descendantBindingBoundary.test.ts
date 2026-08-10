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
})
