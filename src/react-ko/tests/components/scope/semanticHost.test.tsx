import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
import ko from 'knockout'
import {
  KnockoutScope,
  KoForeach,
  KoIf,
  KoIfNot,
  KoWith,
  RootKnockoutProvider,
} from '@/index'

describe('semantic hosts', () => {
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
            {(item) => <span data-bind="text: label">{item.label()}</span>}
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
})
