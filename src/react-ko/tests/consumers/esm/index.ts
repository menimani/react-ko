import { createElement, type ComponentProps, type ReactNode } from 'react'
import ko from 'knockout'
import {
  AppViewModelContext,
  KnockoutScope,
  KoForeach,
  KoIf,
  KoIfNot,
  KoScope,
  KoWith,
  RootKnockoutProvider,
  createAppViewModelContext,
  useAppViewModel,
  useKoValue,
  type AppViewModelContextHandle,
} from 'react-ko'

declare global {
  interface HTMLElementTagNameMap {
    'custom-host': HTMLElement
  }
}

type Equal<Left, Right> =
  (<T>() => T extends Left ? 1 : 2) extends
  (<T>() => T extends Right ? 1 : 2) ? true : false

function expectType<Expected>(_value: Expected): void {}
function expectTrue<_Value extends true>(): void {}

type ViewModel = {
  title: string
  count: ko.Observable<number>
}

const viewModel: ViewModel = {
  title: 'consumer',
  count: ko.observable(1),
}
const child: ReactNode = createElement('span')

createElement(AppViewModelContext.Provider, { value: viewModel, children: child })
createElement(AppViewModelContext.Provider, { value: 'the legacy context accepts unknown', children: child })

const typedContext: AppViewModelContextHandle<ViewModel> = createAppViewModelContext<ViewModel>()
createElement(typedContext.Provider, { value: viewModel, children: child })
expectType<ViewModel>(typedContext.useAppViewModel())
// @ts-expect-error The factory's Provider must use the same ViewModel type as its hook.
createElement(typedContext.Provider, { value: { title: 'missing count' }, children: child })

expectType<ViewModel>(useAppViewModel<ViewModel>())

createElement(RootKnockoutProvider, { viewModel, children: child })
createElement(RootKnockoutProvider, { viewModel, children: child, boundaryAs: 'main', as: 'section' })
createElement(RootKnockoutProvider, { viewModel, children: child, as: 'custom-host' })
// @ts-expect-error Scope hosts always contain children, so void elements are invalid.
createElement(RootKnockoutProvider, { viewModel, children: child, boundaryAs: 'input' })
// @ts-expect-error A root requires a view model.
createElement(RootKnockoutProvider, { children: child })
// @ts-expect-error A root requires children.
createElement(RootKnockoutProvider, { viewModel })

createElement(KnockoutScope, { viewModel, children: child })
createElement(KnockoutScope, { viewModel, children: child, boundaryAs: 'li', as: 'span' })
// @ts-expect-error Scope hosts always contain children, so void elements are invalid.
createElement(KnockoutScope, { viewModel, children: child, as: 'img' })
// @ts-expect-error Semantic hosts must be HTML elements.
createElement(KnockoutScope, { viewModel, children: child, as: 'svg' })
createElement(KoScope, { viewModel: { row: 1 }, children: child })
// @ts-expect-error A scope requires a view model.
createElement(KnockoutScope, { children: child })
// @ts-expect-error The KoScope alias has the same required children prop.
createElement(KoScope, { viewModel })

const booleanObservable = ko.observable(true)
const booleanComputed = ko.pureComputed(() => booleanObservable())
createElement(KoIf, { condition: true, children: child })
createElement(KoIf, { condition: true, children: child, boundaryAs: 'span', as: 'span' })
createElement(KoIf, { condition: booleanObservable, children: child })
createElement(KoIf, { condition: booleanComputed, children: child })
createElement(KoIfNot, { condition: false, children: child })
createElement(KoIfNot, { condition: booleanObservable, children: child })
createElement(KoIfNot, { condition: booleanComputed, children: child })
// @ts-expect-error Conditions are boolean values or boolean subscribables.
createElement(KoIf, { condition: 'yes', children: child })
// @ts-expect-error KoIfNot requires children.
createElement(KoIfNot, { condition: false })

type Row = { id: number; label: string }
const rows: Row[] = [{ id: 1, label: 'one' }]
const observableRows = ko.observableArray(rows)
const computedRows = ko.pureComputed(() => observableRows())

KoForeach({
  items: rows,
  children: (row, index) => {
    expectType<Row>(row)
    expectType<number>(index)
    return row.label
  },
  itemKey: (row, index) => `${row.id}:${index}`,
})
KoForeach({ items: observableRows, children: (row) => row.label })
KoForeach({ items: rows, children: (row) => row.label, boundaryAs: 'li', as: 'span' })
KoForeach({ items: computedRows, children: (row) => row.label })
// @ts-expect-error The render callback receives the inferred item type.
KoForeach({ items: rows, children: (row: string) => row })
// @ts-expect-error itemKey must return a React key.
KoForeach({ items: rows, children: () => null, itemKey: () => ({}) })

const selected = ko.observable<Row | null>(rows[0])
const computedSelection = ko.pureComputed<Row | undefined>(() => rows[0])
KoWith({ value: rows[0], children: (row) => row.label })
KoWith({ value: rows[0], children: (row) => row.label, boundaryAs: 'aside', as: 'section' })
KoWith({
  value: selected,
  children: (row) => {
    expectType<Row>(row)
    return row.label
  },
})
KoWith({ value: computedSelection, children: (row) => row.label })
// @ts-expect-error The child receives the non-nullable inferred value type.
KoWith({ value: selected, children: (row: string) => row })

expectType<number>(useKoValue(1))
expectType<number>(useKoValue(viewModel.count))
expectType<number>(useKoValue(ko.pureComputed(() => viewModel.count())))
expectType<Row[]>(useKoValue(observableRows))
// @ts-expect-error An explicit result type must agree with the source.
useKoValue<number>('not a number')

type RootProps = ComponentProps<typeof RootKnockoutProvider>
type ScopeProps = ComponentProps<typeof KnockoutScope>
expectTrue<Equal<RootProps['children'], ReactNode>>()
expectTrue<Equal<ScopeProps['children'], ReactNode>>()
