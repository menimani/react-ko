import * as ko from 'knockout'
import { KoForeach } from '../../dist/index.js'

type Row = { label: string }

const rows: ko.Observable<Row[]> = ko.observable([{ label: 'one' }])

KoForeach({
  items: rows,
  children: (row) => row.label,
})
