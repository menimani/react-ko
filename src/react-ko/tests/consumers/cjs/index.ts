import React = require('react')
import ko = require('knockout')
import ReactKo = require('react-ko')

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
const child: React.ReactNode = React.createElement('span')

React.createElement(ReactKo.AppViewModelContext.Provider, { value: viewModel, children: child })
React.createElement(ReactKo.AppViewModelContext.Provider, {
  value: 'the legacy context accepts unknown',
  children: child,
})

const typedContext: ReactKo.AppViewModelContextHandle<ViewModel> =
  ReactKo.createAppViewModelContext<ViewModel>()
React.createElement(typedContext.Provider, { value: viewModel, children: child })
expectType<ViewModel>(typedContext.useAppViewModel())
// @ts-expect-error The factory's Provider must use the same ViewModel type as its hook.
React.createElement(typedContext.Provider, { value: { title: 'missing count' }, children: child })

expectType<ViewModel>(ReactKo.useAppViewModel<ViewModel>())

React.createElement(ReactKo.RootKnockoutProvider, { viewModel, children: child })
React.createElement(ReactKo.RootKnockoutProvider, { viewModel, children: child, boundaryAs: 'main', as: 'section' })
// @ts-expect-error Scope hosts always contain children, so void elements are invalid.
React.createElement(ReactKo.RootKnockoutProvider, { viewModel, children: child, boundaryAs: 'input' })
// @ts-expect-error A root requires a view model.
React.createElement(ReactKo.RootKnockoutProvider, { children: child })
// @ts-expect-error A root requires children.
React.createElement(ReactKo.RootKnockoutProvider, { viewModel })

React.createElement(ReactKo.KnockoutScope, { viewModel, children: child })
React.createElement(ReactKo.KnockoutScope, { viewModel, children: child, boundaryAs: 'li', as: 'span' })
// @ts-expect-error Scope hosts always contain children, so void elements are invalid.
React.createElement(ReactKo.KnockoutScope, { viewModel, children: child, as: 'img' })
// @ts-expect-error Semantic hosts must be HTML elements.
React.createElement(ReactKo.KnockoutScope, { viewModel, children: child, as: 'svg' })
React.createElement(ReactKo.KoScope, { viewModel: { row: 1 }, children: child })
// @ts-expect-error A scope requires a view model.
React.createElement(ReactKo.KnockoutScope, { children: child })
// @ts-expect-error The KoScope alias has the same required children prop.
React.createElement(ReactKo.KoScope, { viewModel })

const booleanObservable = ko.observable(true)
const booleanComputed = ko.pureComputed(() => booleanObservable())
React.createElement(ReactKo.KoIf, { condition: true, children: child })
React.createElement(ReactKo.KoIf, { condition: true, children: child, boundaryAs: 'span', as: 'span' })
React.createElement(ReactKo.KoIf, { condition: booleanObservable, children: child })
React.createElement(ReactKo.KoIf, { condition: booleanComputed, children: child })
React.createElement(ReactKo.KoIfNot, { condition: false, children: child })
React.createElement(ReactKo.KoIfNot, { condition: booleanObservable, children: child })
React.createElement(ReactKo.KoIfNot, { condition: booleanComputed, children: child })
// @ts-expect-error Conditions are boolean values or boolean subscribables.
React.createElement(ReactKo.KoIf, { condition: 'yes', children: child })
// @ts-expect-error KoIfNot requires children.
React.createElement(ReactKo.KoIfNot, { condition: false })

type Row = { id: number; label: string }
const rows: Row[] = [{ id: 1, label: 'one' }]
const observableRows = ko.observableArray(rows)
const computedRows = ko.pureComputed(() => observableRows())

ReactKo.KoForeach({
  items: rows,
  children: (row, index) => {
    expectType<Row>(row)
    expectType<number>(index)
    return row.label
  },
  itemKey: (row, index) => `${row.id}:${index}`,
})
ReactKo.KoForeach({ items: observableRows, children: (row) => row.label })
ReactKo.KoForeach({ items: rows, children: (row) => row.label, boundaryAs: 'li', as: 'span' })
ReactKo.KoForeach({ items: computedRows, children: (row) => row.label })
// @ts-expect-error The render callback receives the inferred item type.
ReactKo.KoForeach({ items: rows, children: (row: string) => row })
// @ts-expect-error itemKey must return a React key.
ReactKo.KoForeach({ items: rows, children: () => null, itemKey: () => ({}) })

const selected = ko.observable<Row | null>(rows[0])
const computedSelection = ko.pureComputed<Row | undefined>(() => rows[0])
ReactKo.KoWith({ value: rows[0], children: (row) => row.label })
ReactKo.KoWith({ value: rows[0], children: (row) => row.label, boundaryAs: 'aside', as: 'section' })
ReactKo.KoWith({
  value: selected,
  children: (row) => {
    expectType<Row>(row)
    return row.label
  },
})
ReactKo.KoWith({ value: computedSelection, children: (row) => row.label })
// @ts-expect-error The child receives the non-nullable inferred value type.
ReactKo.KoWith({ value: selected, children: (row: string) => row })

expectType<number>(ReactKo.useKoValue(1))
expectType<number>(ReactKo.useKoValue(viewModel.count))
expectType<number>(ReactKo.useKoValue(ko.pureComputed(() => viewModel.count())))
expectType<Row[]>(ReactKo.useKoValue(observableRows))
// @ts-expect-error An explicit result type must agree with the source.
ReactKo.useKoValue<number>('not a number')

type RootProps = React.ComponentProps<typeof ReactKo.RootKnockoutProvider>
type ScopeProps = React.ComponentProps<typeof ReactKo.KnockoutScope>
expectTrue<Equal<RootProps['children'], React.ReactNode>>()
expectTrue<Equal<ScopeProps['children'], React.ReactNode>>()
