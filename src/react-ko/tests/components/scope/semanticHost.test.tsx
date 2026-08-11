import { describe, expect, it, vi } from 'vitest'
import { render } from '@testing-library/react'
import { createElement, type ComponentType, useLayoutEffect, useRef } from 'react'
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

  it('renders declaration-merged custom elements as semantic hosts', () => {
    const vm = { label: ko.observable('Custom host') }
    const { container } = render(
      <RootKnockoutProvider
        viewModel={vm}
        boundaryAs="custom-host"
        as="custom-host"
      >
        <span data-bind="text: label" />
      </RootKnockoutProvider>
    )

    expect(container.querySelector('custom-host > custom-host')?.textContent).toBe(
      'Custom host'
    )
  })

  it.each(['marquee', 'dir', 'font', 'frameset'])(
    'accepts the mapped non-void <%s> host at runtime',
    (host) => {
      expect(() => semanticHostComponent(host as never)).not.toThrow()
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
    ['as', 'customhost'],
    ['boundaryAs', 'customhost'],
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
})
