import * as ko from 'knockout'
import * as React from 'react'
import { KoForeach, type KoBindProps } from '../../dist/index.js'

type Row = { label: string }

const rows: ko.Observable<Row[]> = ko.observable([{ label: 'one' }])

// A row that binds nothing can ignore the binding root it is handed.
KoForeach({
  items: rows,
  children: (row) => row.label,
})

KoForeach({
  items: rows,
  children: (row, _index, bind: KoBindProps) =>
    React.createElement('option', bind, row.label),
})

KoForeach({
  items: rows,
  // @ts-expect-error A row no longer chooses a binding mode; it receives a binding root.
  bindingMode: 'element',
  children: (row) => React.createElement('option', null, row.label),
})

KoForeach({
  items: rows,
  // @ts-expect-error A row renders no host of its own, so it has no semantic host.
  as: 'div',
  children: (row) => React.createElement('option', null, row.label),
})
