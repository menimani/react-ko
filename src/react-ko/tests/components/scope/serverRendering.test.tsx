import { act } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import ko from 'knockout'
import { describe, expect, it } from 'vitest'
import {
  AppViewModelContext,
  KnockoutScope,
  RootKnockoutProvider,
} from '@/index'

type ViewModel = {
  label: ko.Observable<string>
}

type ScopeFactory = (viewModel: ViewModel, children: ReactNode) => ReactElement

const scopes: Array<[string, ScopeFactory]> = [
  [
    'RootKnockoutProvider',
    (viewModel, children) => (
      <RootKnockoutProvider viewModel={viewModel}>{children}</RootKnockoutProvider>
    ),
  ],
  [
    'KnockoutScope',
    (viewModel, children) => (
      <AppViewModelContext.Provider value={{}}>
        <KnockoutScope viewModel={viewModel}>{children}</KnockoutScope>
      </AppViewModelContext.Provider>
    ),
  ],
]

function childTree() {
  return (
    <section data-testid="server-child">
      Server child
      <input data-testid="bound-input" data-bind="value: label" />
    </section>
  )
}

describe.each(scopes)('%s server rendering', (_, createScope) => {
  it('includes its child subtree in the server output', () => {
    const html = renderToString(
      createScope({ label: ko.observable('Server') }, childTree())
    )

    expect(html).toContain('Server child')
    expect(html).toContain('data-testid="bound-input"')
  })

  it('preserves and binds its server-rendered children during hydration', async () => {
    const viewModel = { label: ko.observable('Hydrated') }
    const tree = createScope(viewModel, childTree())
    const container = document.createElement('div')
    container.innerHTML = renderToString(tree)
    document.body.appendChild(container)
    const serverChild = container.querySelector('[data-testid="server-child"]')
    let root: Root | undefined

    try {
      await act(async () => {
        root = hydrateRoot(container, tree)
      })

      expect(container.querySelector('[data-testid="server-child"]')).toBe(
        serverChild
      )
      expect(container.querySelector('[data-testid="bound-input"]')).toHaveProperty(
        'value',
        'Hydrated'
      )
    } finally {
      if (root !== undefined) {
        act(() => root?.unmount())
      }
      container.remove()
    }
  })
})
