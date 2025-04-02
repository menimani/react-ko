import { describe, it, expect } from 'vitest'
import { render, act } from '@testing-library/react'
import ko from 'knockout'
import { RootKnockoutProvider, KnockoutScope, KoScope } from '@/index'

describe('KnockoutScope', () => {
  it('updates DOM when observable changes (observable → DOM)', () => {
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

  it.fails('fails when expected DOM value does not match observable (observable → DOM)', () => {
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

    expect(input.value).toBe('WrongValue') // intentionally incorrect
  })

  it('updates observable via input event when valueUpdate is "input" (DOM → observable)', () => {
    const vm = { name: ko.observable('Hello') }

    const { container } = render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <input data-bind="value: name, valueUpdate: 'input'" />
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    const input = container.querySelector('input')!
    expect(vm.name()).toBe('Hello')

    act(() => {
      input.value = 'World'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })

    expect(vm.name()).toBe('World')
  })

  it.fails('fails to update observable on input event without valueUpdate (DOM → observable)', () => {
    const vm = { name: ko.observable('Hello') }

    const { container } = render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <input data-bind="value: name" />
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    const input = container.querySelector('input')!
    expect(vm.name()).toBe('Hello')

    act(() => {
      input.value = 'World'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })

    expect(vm.name()).toBe('World') // KO won't update here
  })

  it('updates observable via change event (DOM → observable, default KO behavior)', () => {
    const vm = { name: ko.observable('Hello') }

    const { container } = render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <input data-bind="value: name" />
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    const input = container.querySelector('input')!
    expect(vm.name()).toBe('Hello')

    act(() => {
      input.value = 'World'
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })

    expect(vm.name()).toBe('World')
  })

  it.fails('fails when input triggers change event but expected value mismatches (DOM → observable)', () => {
    const vm = { name: ko.observable('Hello') }

    const { container } = render(
      <RootKnockoutProvider viewModel={{}}>
        <KnockoutScope viewModel={vm}>
          <input data-bind="value: name" />
        </KnockoutScope>
      </RootKnockoutProvider>
    )

    const input = container.querySelector('input')!
    expect(vm.name()).toBe('Hello')

    act(() => {
      input.value = 'World'
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })

    expect(vm.name()).toBe('WrongValue') // intentionally incorrect
  })
})

describe('KoScope', () => {
  it('updates DOM when observable changes (observable → DOM)', () => {
    const vm = { name: ko.observable('Hello') }

    const { container } = render(
      <RootKnockoutProvider viewModel={{}}>
        <KoScope viewModel={vm}>
          <input data-bind="value: name" />
        </KoScope>
      </RootKnockoutProvider>
    )

    const input = container.querySelector('input')!
    expect(input.value).toBe('Hello')

    act(() => {
      vm.name('World')
    })

    expect(input.value).toBe('World')
  })

  it.fails('fails when expected DOM value does not match observable (observable → DOM)', () => {
    const vm = { name: ko.observable('Hello') }

    const { container } = render(
      <RootKnockoutProvider viewModel={{}}>
        <KoScope viewModel={vm}>
          <input data-bind="value: name" />
        </KoScope>
      </RootKnockoutProvider>
    )

    const input = container.querySelector('input')!
    expect(input.value).toBe('Hello')

    act(() => {
      vm.name('World')
    })

    expect(input.value).toBe('WrongValue') // intentionally incorrect
  })

  it('updates observable via input event when valueUpdate is "input" (DOM → observable)', () => {
    const vm = { name: ko.observable('Hello') }

    const { container } = render(
      <RootKnockoutProvider viewModel={{}}>
        <KoScope viewModel={vm}>
          <input data-bind="value: name, valueUpdate: 'input'" />
        </KoScope>
      </RootKnockoutProvider>
    )

    const input = container.querySelector('input')!
    expect(vm.name()).toBe('Hello')

    act(() => {
      input.value = 'World'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })

    expect(vm.name()).toBe('World')
  })

  it.fails('fails to update observable on input event without valueUpdate (DOM → observable)', () => {
    const vm = { name: ko.observable('Hello') }

    const { container } = render(
      <RootKnockoutProvider viewModel={{}}>
        <KoScope viewModel={vm}>
          <input data-bind="value: name" />
        </KoScope>
      </RootKnockoutProvider>
    )

    const input = container.querySelector('input')!
    expect(vm.name()).toBe('Hello')

    act(() => {
      input.value = 'World'
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })

    expect(vm.name()).toBe('World') // KO won't update here
  })

  it('updates observable via change event (DOM → observable, default KO behavior)', () => {
    const vm = { name: ko.observable('Hello') }

    const { container } = render(
      <RootKnockoutProvider viewModel={{}}>
        <KoScope viewModel={vm}>
          <input data-bind="value: name" />
        </KoScope>
      </RootKnockoutProvider>
    )

    const input = container.querySelector('input')!
    expect(vm.name()).toBe('Hello')

    act(() => {
      input.value = 'World'
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })

    expect(vm.name()).toBe('World')
  })

  it.fails('fails when input triggers change event but expected value mismatches (DOM → observable)', () => {
    const vm = { name: ko.observable('Hello') }

    const { container } = render(
      <RootKnockoutProvider viewModel={{}}>
        <KoScope viewModel={vm}>
          <input data-bind="value: name" />
        </KoScope>
      </RootKnockoutProvider>
    )

    const input = container.querySelector('input')!
    expect(vm.name()).toBe('Hello')

    act(() => {
      input.value = 'World'
      input.dispatchEvent(new Event('change', { bubbles: true }))
    })

    expect(vm.name()).toBe('WrongValue') // intentionally incorrect
  })
})