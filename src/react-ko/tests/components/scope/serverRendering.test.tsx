import { act, waitFor } from '@testing-library/react'
import {
  Component,
  Suspense,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import ko from 'knockout'
import { describe, expect, it, vi } from 'vitest'
import {
  KnockoutScope,
  KoForeach,
  useKoValue,
  useKoViewModel,
} from '@/index'
import { BindingHost } from '../../fixtures/bindingHost'

class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    return this.state.error === null ? (
      this.props.children
    ) : (
      <span data-testid="binding-error">{this.state.error.message}</span>
    )
  }
}

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

function ScopeViewModelProbe() {
  const viewModel = useKoViewModel<{
    contextLabel: string
    boundLabel: ko.Observable<string>
  }>()

  return (
    <section data-testid="scope-child">
      <span data-testid="scope-context">{viewModel.contextLabel}</span>
      <input data-testid="scope-bound-input" data-bind="value: boundLabel" />
    </section>
  )
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

describe('BindingHost server rendering', () => {
  it('includes its child subtree in the server output', () => {
    const html = renderToString(
      <BindingHost viewModel={{ label: ko.observable('Server') }}>
        {childTree()}
      </BindingHost>
    )

    expect(html).toContain('Server child')
    expect(html).toContain('data-testid="bound-input"')
  })

  it('preserves and binds its server-rendered children during hydration', async () => {
    const viewModel = { label: ko.observable('Hydrated') }
    const tree = <BindingHost viewModel={viewModel}>{childTree()}</BindingHost>
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
    let resolve: () => void = () => undefined
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

    const tree = (
      <BindingHost viewModel={viewModel}>
        <Suspense fallback={<span>Fallback</span>}>
          <DelayedChild />
        </Suspense>
      </BindingHost>
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

it('binds hydrated Suspense markup despite continuous sibling mutations', async () => {
  vi.useFakeTimers()
  const label = ko.observable('Knockout value')
  let hydrating = false
  let ready = false
  let resolveChild: () => void = () => undefined
  const suspended = new Promise<void>((resolve) => {
    resolveChild = resolve
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

  const tree = (
    <BindingHost viewModel={{ label }}>
      <span data-testid="mutating-sibling" />
      <Suspense fallback={null}>
        <DelayedChild />
      </Suspense>
    </BindingHost>
  )
  const container = serverContainer(tree)
  const bound = container.querySelector('[data-testid="suspended-bound"]')
  const sibling = container.querySelector('[data-testid="mutating-sibling"]')
  document.body.appendChild(container)
  hydrating = true
  let root: Root | undefined

  try {
    await act(async () => {
      root = hydrateRoot(container, tree)
    })

    await act(async () => {
      ready = true
      resolveChild()
      await suspended
    })

    expect(bound).toHaveProperty('title', 'Server value')
    expect(label.getSubscriptionsCount()).toBe(0)

    for (let tick = 1; tick <= 5; tick += 1) {
      await act(async () => {
        sibling?.setAttribute('data-tick', String(tick))
        await Promise.resolve()
        await vi.advanceTimersByTimeAsync(4)
      })
    }

    expect(bound).toHaveProperty('title', 'Knockout value')
    expect(label.getSubscriptionsCount()).toBe(1)
  } finally {
    if (root !== undefined && container.isConnected) {
      act(() => root?.unmount())
    }
    container.remove()
    vi.useRealTimers()
  }
})

describe('KnockoutScope server rendering', () => {
  it('provides server context and preserves its bound children during hydration', async () => {
    const boundLabel = ko.observable('Hydrated')
    const tree = (
      <BindingHost viewModel={{}}>
        <KnockoutScope viewModel={{ contextLabel: 'Server context', boundLabel }}>
          <ScopeViewModelProbe />
        </KnockoutScope>
      </BindingHost>
    )
    const container = serverContainer(tree)
    const serverChild = container.querySelector('[data-testid="scope-child"]')
    document.body.appendChild(container)
    let root: Root | undefined

    try {
      expect(
        container.querySelector('[data-testid="scope-context"]')?.textContent
      ).toBe('Server context')

      await act(async () => {
        root = hydrateRoot(container, tree)
      })

      expect(container.querySelector('[data-testid="scope-child"]')).toBe(
        serverChild
      )
      expect(
        container.querySelector('[data-testid="scope-bound-input"]')
      ).toHaveProperty('value', 'Hydrated')

      act(() => {
        boundLabel('Observable update')
      })

      expect(
        container.querySelector('[data-testid="scope-bound-input"]')
      ).toHaveProperty('value', 'Observable update')
    } finally {
      if (root !== undefined) act(() => root?.unmount())
      container.remove()
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

it('stops deferred Suspense polling when the boundary is removed', async () => {
  vi.useFakeTimers()
  const setTimeout = vi.spyOn(window, 'setTimeout')
  const label = ko.observable('Still mounted')
  const viewModel = { label }
  let hydrating = false
  let removeBoundary: () => void = () => undefined
  const suspended = new Promise<void>(() => undefined)

  function UnresolvedChild() {
    if (hydrating) throw suspended
    return <span data-testid="deferred-child" data-bind="text: label" />
  }

  function App() {
    const [showBoundary, setShowBoundary] = useState(true)
    removeBoundary = () => setShowBoundary(false)
    return (
      <BindingHost viewModel={viewModel}>
        <span data-testid="mounted-sibling" data-bind="text: label" />
        {showBoundary && (
          <Suspense fallback={null}>
            <UnresolvedChild />
          </Suspense>
        )}
      </BindingHost>
    )
  }

  const tree = <App />
  const container = serverContainer(tree)
  document.body.appendChild(container)
  hydrating = true
  let root: Root | undefined
  const pollingDelays = new Set([16, 32, 64, 128, 256, 512, 1000])

  try {
    await act(async () => {
      root = hydrateRoot(container, tree)
    })

    expect(
      setTimeout.mock.calls.filter(([, delay]) => pollingDelays.has(delay ?? 0))
    ).toHaveLength(1)

    await act(async () => {
      removeBoundary()
      await Promise.resolve()
      await vi.advanceTimersByTimeAsync(16)
    })

    expect(container.querySelector('[data-testid="deferred-child"]')).toBeNull()
    expect(
      container.querySelector('[data-testid="mounted-sibling"]')?.textContent
    ).toBe('Still mounted')
    expect(label.getSubscriptionsCount()).toBe(1)
    const settledPollingCalls = setTimeout.mock.calls.filter(([, delay]) =>
      pollingDelays.has(delay ?? 0)
    ).length

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })

    expect(
      setTimeout.mock.calls.filter(([, delay]) => pollingDelays.has(delay ?? 0))
    ).toHaveLength(settledPollingCalls)

    act(() => label('Updated while mounted'))
    expect(
      container.querySelector('[data-testid="mounted-sibling"]')?.textContent
    ).toBe('Updated while mounted')
  } finally {
    if (root !== undefined && container.isConnected) {
      act(() => root?.unmount())
    }
    container.remove()
    setTimeout.mockRestore()
    vi.useRealTimers()
  }
})

it('reports a binding failure from newly hydrated Suspense markup and cleans up', async () => {
  vi.useFakeTimers()
  const setTimeout = vi.spyOn(window, 'setTimeout')
  const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect')
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  const label = ko.observable('Bound before failure')
  let hydrating = false
  let ready = false
  let resolveChild: () => void = () => undefined
  const suspended = new Promise<void>((resolve) => {
    resolveChild = resolve
  })

  function DelayedInvalidChild() {
    if (hydrating && !ready) throw suspended
    return (
      <section>
        <span data-bind="text: label" />
        <span data-bind="text: missing.value" />
      </section>
    )
  }

  const tree = (
    <ErrorBoundary>
      <BindingHost viewModel={{ label }}>
        <Suspense fallback={null}>
          <DelayedInvalidChild />
        </Suspense>
      </BindingHost>
    </ErrorBoundary>
  )
  const container = serverContainer(tree)
  document.body.appendChild(container)
  hydrating = true
  let root: Root | undefined
  const pollingDelays = new Set([16, 32, 64, 128, 256, 512, 1000])

  try {
    await act(async () => {
      root = hydrateRoot(container, tree)
    })

    expect(label.getSubscriptionsCount()).toBe(0)

    await act(async () => {
      ready = true
      resolveChild()
      await suspended
    })

    await act(async () => {
      await vi.advanceTimersByTimeAsync(16)
    })

    expect(
      container.querySelector('[data-testid="binding-error"]')?.textContent
    ).toContain('missing is not defined')
    expect(disconnect).toHaveBeenCalled()
    expect(label.getSubscriptionsCount()).toBe(0)
    const settledPollingCalls = setTimeout.mock.calls.filter(([, delay]) =>
      pollingDelays.has(delay ?? 0)
    ).length

    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000)
    })

    expect(
      setTimeout.mock.calls.filter(([, delay]) => pollingDelays.has(delay ?? 0))
    ).toHaveLength(settledPollingCalls)
  } finally {
    if (root !== undefined && container.isConnected) {
      act(() => root?.unmount())
    }
    container.remove()
    setTimeout.mockRestore()
    disconnect.mockRestore()
    consoleError.mockRestore()
    vi.useRealTimers()
  }
})

it('reports a deferred binding failure inside nested Suspense boundaries and cleans up', async () => {
  const setTimeout = vi.spyOn(window, 'setTimeout')
  const clearTimeout = vi.spyOn(window, 'clearTimeout')
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  const label = ko.observable('Bound after outer hydration')
  let hydrating = false
  let outerReady = false
  let showInvalidBinding: () => void = () => undefined
  let resolveOuter: () => void = () => undefined
  const outerSuspended = new Promise<void>((resolve) => {
    resolveOuter = resolve
  })
  const innerSuspended = new Promise<void>(() => undefined)

  function InnerChild() {
    if (hydrating) throw innerSuspended
    return <span data-bind="text: label" />
  }

  function OuterChild() {
    if (hydrating && !outerReady) throw outerSuspended
    const [invalidBinding, setInvalidBinding] = useState(false)
    showInvalidBinding = () => setInvalidBinding(true)
    return (
      <section>
        <span data-testid="outer-bound" data-bind="text: label" />
        <span
          data-testid="late-bound"
          data-bind={invalidBinding ? 'text: missing.value' : undefined}
        />
        <Suspense fallback={<span>Inner fallback</span>}>
          <InnerChild />
        </Suspense>
      </section>
    )
  }

  const tree = (
    <ErrorBoundary>
      <BindingHost viewModel={{ label }}>
        <Suspense fallback={<span>Outer fallback</span>}>
          <OuterChild />
        </Suspense>
      </BindingHost>
    </ErrorBoundary>
  )
  const container = serverContainer(tree)
  document.body.appendChild(container)
  hydrating = true
  let root: Root | undefined

  try {
    await act(async () => {
      root = hydrateRoot(container, tree)
    })

    expect(label.getSubscriptionsCount()).toBe(0)

    await act(async () => {
      outerReady = true
      resolveOuter()
      await outerSuspended
    })

    await waitFor(() =>
      expect(
        container.querySelector('[data-testid="outer-bound"]')?.textContent
      ).toBe('Bound after outer hydration')
    )
    expect(label.getSubscriptionsCount()).toBe(1)

    act(() => {
      showInvalidBinding()
    })

    await waitFor(() =>
      expect(
        container.querySelector('[data-testid="binding-error"]')?.textContent
      ).toContain('missing is not defined')
    )
    expect(label.getSubscriptionsCount()).toBe(0)
    const pollingDelays = new Set([16, 32, 64, 128, 256, 512, 1000])
    const pollingTimers = setTimeout.mock.calls.flatMap(([, delay], index) =>
      pollingDelays.has(delay ?? 0) ? [setTimeout.mock.results[index]?.value] : []
    )
    expect(
      pollingTimers.some((timer) =>
        clearTimeout.mock.calls.some(([cleared]) => cleared === timer)
      )
    ).toBe(true)
    const settledPollingCalls = pollingTimers.length
    await new Promise((resolve) => window.setTimeout(resolve, 50))
    expect(
      setTimeout.mock.calls.filter(([, delay]) => pollingDelays.has(delay ?? 0))
    ).toHaveLength(settledPollingCalls)
  } finally {
    if (root !== undefined && container.isConnected) {
      act(() => root?.unmount())
    }
    container.remove()
    setTimeout.mockRestore()
    clearTimeout.mockRestore()
    consoleError.mockRestore()
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
