import { describe, it, expect } from 'vitest'
import { render, act } from '@testing-library/react'
import React from 'react'
import ko from 'knockout'
import { RootKnockoutProvider, KnockoutScope } from '../src'

describe('KnockoutScope', () => {
  it('binds observable to input element', () => {
    const vm = { name: ko.observable('Hello') }

    const { container } = render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <input data-bind="value: name" />
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    const input = container.querySelector('input')!
    expect(input.value).toBe('Hello')

    act(() => {
      vm.name('World')
    })

    expect(input.value).toBe('World')
  })

  it.fails('binds observable to input element (fails intentionally)', () => {
    const vm = { name: ko.observable('Hello') }
  
    const { container } = render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <input data-bind="value: name" />
        </KnockoutScope>
      </RootKnockoutProvider>
    )
  
    const input = container.querySelector('input')!
    expect(input.value).toBe('Hello')
  
    act(() => {
      vm.name('World')
    })

    expect(input.value).toBe('WrongValue')
  })
})