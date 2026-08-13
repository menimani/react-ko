import React = require('react')
import ko = require('knockout')
import ReactKo = require('react-ko')

function expectType<Expected>(_value: Expected): void {}

type ViewModel = {
  title: string
  count: ko.Observable<number>
}

const viewModel: ViewModel = {
  title: 'consumer',
  count: ko.observable(1),
}

type Row = { id: number; label: string }

const rows: Row[] = [{ id: 1, label: 'one' }]
const observableRows = ko.observableArray<Row>(rows)
const computedRows = ko.pureComputed<Row[]>(() => rows)
const nullableObservableRows = ko.observable<Row[] | null | undefined>(rows)
const nullableComputedRows = ko.pureComputed<Row[] | null | undefined>(
  () => nullableObservableRows()
)
const readonlyRows = [{ id: 2, label: 'two' }] as const
const readonlyObservableRows = ko.observable<readonly Row[]>(readonlyRows)

// useKoBind returns props to spread onto the caller's own element.
const bind: ReactKo.KoBindProps = ReactKo.useKoBind(viewModel)
React.createElement('div', bind)
expectType<(node: HTMLElement | null) => void>(bind.ref)
ReactKo.useKoBind<ViewModel | null>(null)
ReactKo.useKoBind(undefined)

ReactKo.KoForeach({
  items: rows,
  children: (row, index) => {
    expectType<Row>(row)
    expectType<number>(index)
    return row.label
  },
  itemKey: (row, index) => String(row.id) + ":" + String(index),
})
ReactKo.KoForeach({ items: observableRows, children: (row) => row.label })
ReactKo.KoForeach({
  items: rows,
  children: (row, _index, rowBind) => {
    expectType<ReactKo.KoBindProps>(rowBind)
    return React.createElement('li', rowBind, row.label)
  },
})
ReactKo.KoForeach({ items: computedRows, children: (row) => row.label })
ReactKo.KoForeach({ items: nullableObservableRows, children: (row) => row.label })
ReactKo.KoForeach({ items: nullableComputedRows, children: (row) => row.label })
ReactKo.KoForeach({
  items: readonlyRows,
  children: (row) => {
    expectType<'two'>(row.label)
    return row.label
  },
})
ReactKo.KoForeach({
  items: readonlyObservableRows,
  children: (row) => {
    expectType<Row>(row)
    return row.label
  },
})
ReactKo.KoForeach<Row>({ items: null, children: (row) => row.label })
ReactKo.KoForeach<Row>({ items: undefined, children: (row) => row.label })
// @ts-expect-error The render callback receives the inferred item type.
ReactKo.KoForeach({ items: rows, children: (row: string) => row })
// @ts-expect-error itemKey must return a React key.
ReactKo.KoForeach({ items: rows, children: () => null, itemKey: () => ({}) })

expectType<number>(ReactKo.useKoValue(1))
expectType<number>(ReactKo.useKoValue(viewModel.count))
expectType<number>(ReactKo.useKoValue(ko.pureComputed(() => viewModel.count())))
expectType<Row[] | null | undefined>(ReactKo.useKoValue(observableRows))
// @ts-expect-error An explicit result type must agree with the source.
ReactKo.useKoValue<number>('not a number')
