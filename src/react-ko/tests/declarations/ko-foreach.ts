import * as ko from 'knockout'
import * as React from 'react'
import { KoForeach } from '../../dist/index.js'

type Row = { label: string }

const rows: ko.Observable<Row[]> = ko.observable([{ label: 'one' }])

KoForeach({
  items: rows,
  children: (row) => row.label,
})

KoForeach({
  items: rows,
  bindingMode: 'element',
  children: (row) => React.createElement('option', null, row.label),
})

KoForeach({
  items: rows,
  bindingMode: 'element',
  // @ts-expect-error Element mode has no semantic hosts.
  as: 'div',
  children: (row) => React.createElement('option', null, row.label),
})
