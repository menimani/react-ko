import { act, waitFor } from '@testing-library/react'
import { Suspense, type ReactElement, type ReactNode } from 'react'
import { hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import ko from 'knockout'
import { describe, expect, it, vi } from 'vitest'
import {
  AppViewModelContext,
  KoForeach,
  KoIf,
  KoIfNot,
  KoWith,
  KnockoutScope,
  RootKnockoutProvider,
  useKoValue,
} from '@/index'

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
    'RootKnockoutProvider',
    (viewModel, children, as) => (
      <RootKnockoutProvider viewModel={viewModel} as={as as never}>
        {children}
      </RootKnockoutProvider>
    ),
  ],
  [
    'KnockoutScope',
    (viewModel, children, as) => (
      <AppViewModelContext.Provider value={{}}>
        <KnockoutScope viewModel={viewModel} as={as as never}>
          {children}
        </KnockoutScope>
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

  it('rejects <script> as a semantic host during server rendering', () => {
    const tree = createScope(
      { label: ko.observable('Server') },
      'Inert host child',
      'script'
    )

    expect(() => renderToString(tree)).toThrow('inert children')
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
  it('renders KoIf server markup from an observable condition', () => {
    const condition = ko.observable(true)
    const tree = (
      <RootKnockoutProvider viewModel={{}}>
        <KoIf condition={condition}>
          <span>Visible on server</span>
        </KoIf>
      </RootKnockoutProvider>
    )

    expect(serverContainer(tree).textContent).toBe('Visible on server')
  })

  it('hydrates KoIf and reacts to its observable condition', async () => {
    const condition = ko.observable(true)
    const tree = (
      <RootKnockoutProvider viewModel={{}}>
        <KoIf condition={condition}>
          <span>Conditional content</span>
        </KoIf>
      </RootKnockoutProvider>
    )
    const hydrated = await hydrate(tree)

    try {
      expect(hydrated.container.textContent).toBe('Conditional content')

      act(() => {
        condition(false)
      })

      expect(hydrated.container.textContent).toBe('')
    } finally {
      hydrated.unmount()
    }
  })

  it('renders KoIfNot server markup from a computed condition', () => {
    const enabled = ko.observable(false)
    const condition = ko.pureComputed(() => enabled())
    const tree = (
      <RootKnockoutProvider viewModel={{}}>
        <KoIfNot condition={condition}>
          <span>Visible while false</span>
        </KoIfNot>
      </RootKnockoutProvider>
    )

    expect(serverContainer(tree).textContent).toBe('Visible while false')
  })

  it('hydrates KoIfNot and reacts to its computed condition', async () => {
    const enabled = ko.observable(false)
    const condition = ko.pureComputed(() => enabled())
    const tree = (
      <RootKnockoutProvider viewModel={{}}>
        <KoIfNot condition={condition}>
          <span>Inverse content</span>
        </KoIfNot>
      </RootKnockoutProvider>
    )
    const hydrated = await hydrate(tree)

    try {
      expect(hydrated.container.textContent).toBe('Inverse content')

      act(() => {
        enabled(true)
      })

      expect(hydrated.container.textContent).toBe('')
    } finally {
      hydrated.unmount()
    }
  })

  it('renders KoForeach server markup from computed items', () => {
    const source = ko.observableArray(['alpha', 'beta'])
    const items = ko.pureComputed(() => source().map((item) => item.toUpperCase()))
    const tree = (
      <RootKnockoutProvider viewModel={{}}>
        <KoForeach items={items}>
          {(item) => <span data-testid="row">{item}</span>}
        </KoForeach>
      </RootKnockoutProvider>
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
      <RootKnockoutProvider viewModel={{}}>
        <KoForeach items={items}>
          {(item) => <span data-testid="row">{item}</span>}
        </KoForeach>
      </RootKnockoutProvider>
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

  it('renders KoWith server markup from an observable value', () => {
    const value = ko.observable({ label: 'Server selection' })
    const tree = (
      <RootKnockoutProvider viewModel={{}}>
        <KoWith value={value}>
          {(current) => <span>{current.label}</span>}
        </KoWith>
      </RootKnockoutProvider>
    )

    expect(serverContainer(tree).textContent).toBe('Server selection')
  })

  it('hydrates KoWith and reacts to a computed value', async () => {
    const selected = ko.observable({ label: 'First selection' })
    const value = ko.pureComputed(() => selected())
    const tree = (
      <RootKnockoutProvider viewModel={{}}>
        <KoWith value={value}>
          {(current) => <span>{current.label}</span>}
        </KoWith>
      </RootKnockoutProvider>
    )
    const hydrated = await hydrate(tree)

    try {
      expect(hydrated.container.textContent).toBe('First selection')

      act(() => {
        selected({ label: 'Second selection' })
      })

      expect(hydrated.container.textContent).toBe('Second selection')
    } finally {
      hydrated.unmount()
    }
  })
})
