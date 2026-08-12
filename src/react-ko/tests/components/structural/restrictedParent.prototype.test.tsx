import * as React from 'react'
import { act, fireEvent } from '@testing-library/react'
import { createRoot, hydrateRoot, type Root } from 'react-dom/client'
import { renderToString } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

const roots: Root[] = []

afterEach(() => {
  for (const root of roots.splice(0)) {
    act(() => root.unmount())
  }
  document.body.replaceChildren()
})

describe('restricted-parent range prototype', () => {
  it('hydrates and updates raw option fragments when no library range is required', async () => {
    function Options({ values }: { values: string[] }) {
      return <>{values.map((value) => <option key={value}>{value}</option>)}</>
    }

    const container = document.createElement('div')
    container.innerHTML = renderToString(
      <select><Options values={['A']} /></select>
    )
    document.body.appendChild(container)
    const serverOption = container.querySelector('option')
    let root: Root | undefined
    await act(async () => {
      root = hydrateRoot(
        container,
        <select><Options values={['A']} /></select>
      )
    })
    if (root === undefined) throw new Error('Hydration did not create a root')
    roots.push(root)

    expect(container.querySelector('option')).toBe(serverOption)

    act(() => {
      root.render(<select><Options values={['A', 'B']} /></select>)
    })
    expect(Array.from(container.querySelectorAll('option'), ({ value }) => value))
      .toEqual(['A', 'B'])
  })

  it('places a returning child outside comments React does not own', () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    roots.push(root)

    let setVisible: React.Dispatch<React.SetStateAction<boolean>> = () => undefined
    function Prototype() {
      const select = React.useRef<HTMLSelectElement>(null)
      const [visible, updateVisible] = React.useState(true)
      setVisible = updateVisible

      React.useLayoutEffect(() => {
        const parent = select.current
        const option = parent?.querySelector('[data-prototype]')
        if (parent === null || option === null) return
        parent.insertBefore(document.createComment('range-start'), option)
        parent.insertBefore(document.createComment('range-end'), option.nextSibling)
      }, [])

      return (
        <select ref={select}>
          {visible ? <option data-prototype="">prototype</option> : null}
        </select>
      )
    }

    act(() => root.render(<Prototype />))
    act(() => setVisible(false))
    act(() => setVisible(true))

    expect(container.querySelector('select')?.innerHTML).toBe(
      '<!--range-start--><!--range-end--><option data-prototype="">prototype</option>'
    )
  })

  it('loses container ownership when DocumentFragment children are moved', () => {
    const fragment = document.createDocumentFragment()
    const select = document.createElement('select')
    document.body.appendChild(select)
    const root = createRoot(fragment)

    act(() => root.render(<option>prototype</option>))
    select.append(...fragment.childNodes)

    expect(select.options).toHaveLength(1)
    expect(fragment.childNodes).toHaveLength(0)
    expect(() => act(() => root.unmount())).toThrow()
  })

  it('cannot delegate events through a fragment whose mutations target a range', () => {
    const fragment = document.createDocumentFragment()
    const select = document.createElement('select')
    const end = document.createComment('range-end')
    select.append(end)
    document.body.appendChild(select)

    Object.defineProperties(fragment, {
      appendChild: {
        value: (node: Node) => select.insertBefore(node, end),
      },
      insertBefore: {
        value: (node: Node, before: Node | null) =>
          select.insertBefore(node, before ?? end),
      },
      removeChild: {
        value: (node: Node) => select.removeChild(node),
      },
    })

    const onClick = vi.fn()
    const root = createRoot(fragment)
    roots.push(root)
    act(() => root.render(<option onClick={onClick}>prototype</option>))

    const option = select.querySelector('option')
    expect(option?.parentNode).toBe(select)
    expect(option?.parentNode).not.toBe(fragment)
    fireEvent.click(option as HTMLOptionElement)
    expect(onClick).not.toHaveBeenCalled()
  })
})
