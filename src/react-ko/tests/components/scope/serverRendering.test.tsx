import { act, waitFor } from '@testing-library/react'
import { Suspense, type ReactElement, type ReactNode } from 'react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import ko from 'knockout'
import { describe, expect, it, vi } from 'vitest'
import { KoForeach, useKoValue } from '@/index'
import { BindingHost } from '../../fixtures/bindingHost'

type ViewModel = {
  label: ko.Observable<string>
}

type ScopeFactory = (
  viewModel: ViewModel,
  children: ReactNode,
  as?: string
) => ReactElement

const scopes: Array<[string, ScopeFactory]> = [
  [
    'BindingHost',
    (viewModel, children, as) => (
      <BindingHost viewModel={viewModel} as={as as never}>
        {children}
      </BindingHost>
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

function ValueProbe({ source }: { source: ko.Observable<string> | ko.Computed<string> }) {
  const value = useKoValue(source)
  return <span data-testid="value">{value}</span>
}

function serverContainer(tree: ReactElement) {
  const container = document.createElement('div')
  container.innerHTML = renderToString(tree)
  return container
}

async function hydrate(tree: ReactElement) {
  const container = serverContainer(tree)
  document.body.appendChild(container)
  let root: Root | undefined

  await act(async () => {
    root = hydrateRoot(container, tree)
  })

  return {
    container,
    unmount() {
      act(() => root?.unmount())
      container.remove()
    },
  }
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

  it('defers bindings inside a dehydrated Suspense boundary', async () => {
    const viewModel = { label: ko.observable('Knockout value') }
    let hydrating = false
    let ready = false
    let resolve = () => undefined
    const suspended = new Promise<void>((done) => {
      resolve = done
    })

    function DelayedChild() {
      if (hydrating && !ready) throw suspended
      return (
        <span
          data-testid="suspended-bound"
          data-bind="attr: { title: label }"
          title="Server value"
        />
      )
    }

    const tree = createScope(
      viewModel,
      <Suspense fallback={<span>Fallback</span>}>
        <DelayedChild />
      </Suspense>
    )
    const container = serverContainer(tree)
    const serverChild = container.querySelector('[data-testid="suspended-bound"]')
    const recoverableErrors: unknown[] = []
    const animationFrame = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation(() => 1)
    document.body.appendChild(container)
    hydrating = true
    let root: Root | undefined

    try {
      await act(async () => {
        root = hydrateRoot(container, tree, {
          onRecoverableError: (error) => recoverableErrors.push(error),
        })
      })

      expect(container.querySelector('[data-testid="suspended-bound"]')).toBe(
        serverChild
      )
      expect(serverChild).toHaveProperty('title', 'Server value')
      expect(viewModel.label.getSubscriptionsCount()).toBe(0)
      expect(animationFrame).not.toHaveBeenCalled()

      await act(async () => {
        ready = true
        resolve()
        await suspended
      })

      await waitFor(() => {
        expect(serverChild).toHaveProperty('title', 'Knockout value')
      })
      expect(container.querySelector('[data-testid="suspended-bound"]')).toBe(
        serverChild
      )
      expect(recoverableErrors).toEqual([])
    } finally {
      if (root !== undefined) act(() => root?.unmount())
      container.remove()
      animationFrame.mockRestore()
    }
  })
})

it('clears deferred Suspense polling when the binding root unmounts', async () => {
  vi.useFakeTimers()
  const setTimeout = vi.spyOn(window, 'setTimeout')
  const clearTimeout = vi.spyOn(window, 'clearTimeout')
  let hydrating = false
  const suspended = new Promise<void>(() => undefined)

  function UnresolvedChild() {
    if (hydrating) throw suspended
    return <span data-bind="text: label" />
  }

  const tree = (
    <BindingHost viewModel={{ label: 'Deferred' }}>
      <Suspense fallback={null}>
        <UnresolvedChild />
      </Suspense>
    </BindingHost>
  )
  const container = serverContainer(tree)
  document.body.appendChild(container)
  hydrating = true
  let root: Root | undefined

  try {
    await act(async () => {
      root = hydrateRoot(container, tree)
    })

    const pollingCall = setTimeout.mock.calls.find(([, delay]) => delay === 16)
    const pollingCallIndex = setTimeout.mock.calls.indexOf(pollingCall!)
    const pollingTimer = setTimeout.mock.results[pollingCallIndex]?.value
    expect(pollingCall).toBeDefined()
    expect(pollingTimer).toBeDefined()

    act(() => root?.unmount())
    root = undefined

    expect(clearTimeout).toHaveBeenCalledWith(pollingTimer)
  } finally {
    if (root !== undefined && container.isConnected) {
      act(() => root?.unmount())
    }
    container.remove()
    setTimeout.mockRestore()
    clearTimeout.mockRestore()
    vi.useRealTimers()
  }
})

describe('useKoValue server rendering', () => {
  it('renders the current computed value into the server markup', () => {
    const source = ko.observable('Server')
    const value = ko.pureComputed(() => source().toUpperCase())

    const container = serverContainer(<ValueProbe source={value} />)

    expect(container.querySelector('[data-testid="value"]')?.textContent).toBe(
      'SERVER'
    )
  })

  it('hydrates an observable value and reacts to updates', async () => {
    const value = ko.observable('Server')
    const tree = <ValueProbe source={value} />
    const hydrated = await hydrate(tree)

    try {
      expect(hydrated.container.textContent).toBe('Server')

      act(() => {
        value('Hydrated update')
      })

      expect(hydrated.container.textContent).toBe('Hydrated update')
    } finally {
      hydrated.unmount()
    }
  })
})

describe('structural components server rendering', () => {
  it('renders KoForeach server markup from computed items', () => {
    const source = ko.observableArray(['alpha', 'beta'])
    const items = ko.pureComputed(() => source().map((item) => item.toUpperCase()))
    const tree = (
      <BindingHost viewModel={{}}>
        <KoForeach items={items}>
          {(item) => <span data-testid="row">{item}</span>}
        </KoForeach>
      </BindingHost>
    )
    const container = serverContainer(tree)

    expect(
      Array.from(container.querySelectorAll('[data-testid="row"]'), (row) =>
        row.textContent
      )
    ).toEqual(['ALPHA', 'BETA'])
  })

  it('hydrates KoForeach and reacts to an in-place observable array update', async () => {
    const items = ko.observableArray(['alpha'])
    const tree = (
      <BindingHost viewModel={{}}>
        <KoForeach items={items}>
          {(item) => <span data-testid="row">{item}</span>}
        </KoForeach>
      </BindingHost>
    )
    const hydrated = await hydrate(tree)

    try {
      expect(hydrated.container.textContent).toBe('alpha')

      act(() => {
        items.push('beta')
      })

      expect(
        Array.from(
          hydrated.container.querySelectorAll('[data-testid="row"]'),
          (row) => row.textContent
        )
      ).toEqual(['alpha', 'beta'])
    } finally {
      hydrated.unmount()
    }
  })

})
