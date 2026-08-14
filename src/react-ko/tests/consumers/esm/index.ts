import { createElement } from 'react'
import ko from 'knockout'
import {
  KoForeach,
  useKoBind,
  useKoValue,
  useKoViewModel,
  type KoBindProps,
} from 'react-ko'

function expectType<Expected>(_value: Expected): void {}

type Equal<Left, Right> =
  (<T>() => T extends Left ? 1 : 2) extends
  (<T>() => T extends Right ? 1 : 2) ? true : false
type Assert<T extends true> = T

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
const bind: KoBindProps = useKoBind(viewModel)
createElement('div', bind)
expectType<(node: HTMLElement | null) => void>(bind.ref)
useKoBind<ViewModel | null>(null)
useKoBind(undefined)
expectType<ViewModel>(useKoViewModel<ViewModel>())

KoForeach({
  items: rows,
  children: (row, index) => {
    expectType<Row>(row)
    expectType<number>(index)
    return row.label
  },
  itemKey: (row, index) => String(row.id) + ":" + String(index),
})
KoForeach({ items: observableRows, children: (row) => row.label })
KoForeach({
  items: rows,
  children: (row, _index, rowBind) => {
    expectType<KoBindProps>(rowBind)
    return createElement('li', rowBind, row.label)
  },
})
KoForeach({ items: computedRows, children: (row) => row.label })
KoForeach({ items: nullableObservableRows, children: (row) => row.label })
KoForeach({ items: nullableComputedRows, children: (row) => row.label })
KoForeach({
  items: readonlyRows,
  children: (row) => {
    expectType<'two'>(row.label)
    return row.label
  },
})
KoForeach({
  items: readonlyObservableRows,
  children: (row) => {
    expectType<Row>(row)
    return row.label
  },
})
KoForeach<Row>({ items: null, children: (row) => row.label })
KoForeach<Row>({ items: undefined, children: (row) => row.label })
// @ts-expect-error The render callback receives the inferred item type.
KoForeach({ items: rows, children: (row: string) => row })
// @ts-expect-error itemKey must return a React key.
KoForeach({ items: rows, children: () => null, itemKey: () => ({}) })

expectType<number>(useKoValue(1))
expectType<number>(useKoValue(viewModel.count))
expectType<number>(useKoValue(ko.pureComputed(() => viewModel.count())))
const nullableRowsValue = useKoValue(nullableObservableRows)
type NullableRowsValue = Assert<
  Equal<typeof nullableRowsValue, Row[] | null | undefined>
>
void (true satisfies NullableRowsValue)
// @ts-expect-error An explicit result type must agree with the source.
useKoValue<number>('not a number')
