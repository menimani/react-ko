import { createRequire } from 'node:module'
import { render } from '@testing-library/react'
import type ko from 'knockout'
import { expect, it, vi } from 'vitest'

const require = createRequire(import.meta.url)

it('accepts unchanged built-in handlers from the official Knockout debug build', async () => {
  const debugKo = require(
    'knockout/build/output/knockout-latest.debug.js'
  ) as typeof ko

  try {
    vi.resetModules()
    vi.doMock('knockout', () => ({ default: debugKo }))
    const { applyBindingsSafely } = await import(
      '@/components/scope/applyBindingsSafely'
    )
    const { container } = render(
      <div data-bind="visible: shown">
        <span>React child</span>
      </div>
    )

    expect(() => applyBindingsSafely({ shown: true }, container)).not.toThrow()
    expect(container.querySelector('span')?.textContent).toBe('React child')
  } finally {
    vi.doUnmock('knockout')
    vi.resetModules()
  }
})
