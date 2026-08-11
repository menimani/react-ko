import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import {
  createElement,
  type ComponentType,
  useLayoutEffect,
  useRef,
} from 'react'
import { renderToString } from 'react-dom/server'
import ko from 'knockout'
import {
  KnockoutScope,
  KoForeach,
  KoIf,
  KoIfNot,
  KoWith,
  RootKnockoutProvider,
} from '@/index'
import { semanticHostComponent } from '@/components/scope/semanticHost'

declare global {
  interface HTMLElementTagNameMap {
    'custom-host': HTMLElement
    customhost: HTMLElement
  }
}

describe('semantic hosts', () => {
  function renderWithJavaScriptHost(hostProp: 'as' | 'boundaryAs', host: string) {
    const Provider = RootKnockoutProvider as unknown as ComponentType<Record<string, unknown>>
    return render(
      createElement(Provider, {
        viewModel: {},
        children: createElement('span'),
        [hostProp]: host,
      })
    )
  }

  function serverRenderWithJavaScriptHost(
    hostProp: 'as' | 'boundaryAs',
    host: string
  ) {
    const Provider = RootKnockoutProvider as unknown as ComponentType<
      Record<string, unknown>
    >
    return renderToString(
      createElement(Provider, {
        viewModel: {},
        children: createElement('span'),
        [hostProp]: host,
      })
    )
  }

  it('uses selected hosts for roots and scopes without changing binding behavior', () => {
    const vm = { label: ko.observable('Bound') }
    const { container } = render(
      <RootKnockoutProvider viewModel={{}} boundaryAs="main" as="section">
        <ul>
          <KnockoutScope viewModel={vm} boundaryAs="li" as="span">
            <span data-bind="text: label" />
          </KnockoutScope>
        </ul>
      </RootKnockoutProvider>
    )

    expect(container.querySelector(':scope > main > section')).not.toBeNull()
    const list = container.querySelector('ul')!
    expect(list.children).toHaveLength(1)
    expect(list.firstElementChild?.tagName).toBe('LI')
    expect(list.querySelector('li > span > span')?.textContent).toBe('Bound')
  })

  it('passes selected hosts through every structural component', () => {
    const row = { label: ko.observable('Row') }
    const { container } = render(
      <RootKnockoutProvider viewModel={{}}>
        <ul data-testid="rows">
          <KoForeach items={[row]} boundaryAs="li" as="span">
            {() => <span data-bind="text: label" />}
          </KoForeach>
        </ul>
        <button>
          <KoIf condition boundaryAs="span" as="span">if</KoIf>
          <KoIfNot condition={false} boundaryAs="span" as="span">ifnot</KoIfNot>
          <KoWith value={row} boundaryAs="span" as="span">
            {() => <span data-bind="text: label" />}
          </KoWith>
        </button>
      </RootKnockoutProvider>
    )

    expect(container.querySelector('ul')?.firstElementChild?.tagName).toBe('LI')
    expect(container.querySelector('ul li > span > span')?.textContent).toBe('Row')
    expect(container.querySelector('button')?.querySelectorAll(':scope > span')).toHaveLength(3)
    expect(container.querySelector('button')?.textContent).toBe('ififnotRow')
    expect(container.querySelector('button div')).toBeNull()
  })

  it.each(['custom-host', 'customhost'] as const)(
    'renders the declaration-merged <%s> element as a semantic host',
    (host) => {
      const vm = { label: ko.observable('Custom host') }
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      try {
        const { container } = render(
          <RootKnockoutProvider viewModel={vm} boundaryAs={host} as={host}>
            <span data-bind="text: label" />
          </RootKnockoutProvider>
        )

        expect(container.querySelector(`${host} > ${host}`)?.textContent).toBe(
          'Custom host'
        )
      } finally {
        consoleError.mockRestore()
      }
    }
  )

  it.each([
    'marquee',
    'dir',
    'font',
  ])(
    'renders the compatible mapped <%s> host through the public provider',
    (host) => {
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(() => undefined)
      try {
        const { container } = renderWithJavaScriptHost('as', host)

        expect(container.querySelector(host)).not.toBeNull()
        expect(serverRenderWithJavaScriptHost('as', host)).toContain(`<${host}`)
      } finally {
        consoleError.mockRestore()
      }
    }
  )

  it.each([
    'frameset',
    'noembed',
    'noframes',
    'plaintext',
    'script',
    'style',
    'xmp',
    'frame',
    'basefont',
    'bgsound',
    'iframe',
    'template',
  ] as const)(
    'renders and binds the v2 runtime-compatible <%s> semantic host',
    (host) => {
      const vm = { label: ko.observable('Bound') }
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      try {
        const { container } = render(
          <RootKnockoutProvider viewModel={vm} as={host as never}>
            <span data-bind="text: label" />
          </RootKnockoutProvider>
        )

        expect(container.querySelector(`${host} > span`)?.textContent).toBe('Bound')
      } finally {
        consoleError.mockRestore()
      }
    }
  )

  it.each([
    ['INPUT', 'void HTML element'],
    ['SVG', 'scope hosts require a non-void HTML element'],
  ] as const)(
    'classifies the uppercase JavaScript host <%s> as a %s',
    (host, message) => {
      expect(() => semanticHostComponent(host as never)).toThrow(message)
    }
  )

  it.each([
    ['root', 'as'],
    ['root', 'boundaryAs'],
    ['scope', 'as'],
    ['scope', 'boundaryAs'],
  ] as const)(
    'binds a new %s %s host before mounting its descendants',
    (kind, hostProp) => {
      const vm = { label: ko.observable('Initial') }

      function LayoutInput({ update }: { update: boolean }) {
        const input = useRef<HTMLInputElement>(null)
        useLayoutEffect(() => {
          if (update && input.current !== null) {
            input.current.value = 'Changed during layout'
            input.current.dispatchEvent(new Event('input', { bubbles: true }))
          }
        }, [update])
        return <input ref={input} data-bind="textInput: label" />
      }

      function Harness({ replace }: { replace: boolean }) {
        const hosts =
          hostProp === 'as'
            ? { as: replace ? ('section' as const) : ('div' as const) }
            : { boundaryAs: replace ? ('main' as const) : ('div' as const) }
        const content = <LayoutInput update={replace} />
        return kind === 'root' ? (
          <RootKnockoutProvider viewModel={vm} {...hosts}>
            {content}
          </RootKnockoutProvider>
        ) : (
          <RootKnockoutProvider viewModel={{}}>
            <KnockoutScope viewModel={vm} {...hosts}>
              {content}
            </KnockoutScope>
          </RootKnockoutProvider>
        )
      }

      const { rerender, unmount } = render(<Harness replace={false} />)

      expect(vm.label.getSubscriptionsCount()).toBe(1)
      rerender(<Harness replace />)

      expect(vm.label()).toBe('Changed during layout')
      expect(vm.label.getSubscriptionsCount()).toBe(1)

      unmount()

      expect(vm.label.getSubscriptionsCount()).toBe(0)
    }
  )

  it.each(['input', 'img'] as const)('rejects the void <%s> host at runtime', (host) => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    try {
      expect(() =>
        render(
          <RootKnockoutProvider viewModel={{}} as={host as never}>
            <span />
          </RootKnockoutProvider>
        )
      ).toThrow(`cannot use the void HTML element <${host}>`)
    } finally {
      consoleError.mockRestore()
    }
  })

  it.each([
    ['as', 'svg'],
    ['boundaryAs', 'svg'],
  ] as const)(
    'rejects the JavaScript %s value <%s> when it is not a non-void HTML or custom-element tag',
    (hostProp, host) => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      try {
        expect(() => renderWithJavaScriptHost(hostProp, host)).toThrow(
          `cannot use <${host}> as a semantic host because scope hosts require a non-void HTML element`
        )
      } finally {
        consoleError.mockRestore()
      }
    }
  )

  it.each([
    ['as', 'textarea'],
    ['boundaryAs', 'textarea'],
    ['as', 'title'],
    ['boundaryAs', 'title'],
  ] as const)(
    'rejects the JavaScript %s value <%s> when it cannot preserve a child element subtree',
    (hostProp, host) => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
      try {
        expect(() => renderWithJavaScriptHost(hostProp, host)).toThrow(
          `cannot use <${host}> as a semantic host because scope hosts require an HTML element that preserves its child element subtree`
        )
      } finally {
        consoleError.mockRestore()
      }
    }
  )

})
