import * as ko from 'knockout'
import { useKoValue } from '../../dist/index.js'

type Equal<Left, Right> =
  (<T>() => T extends Left ? 1 : 2) extends
  (<T>() => T extends Right ? 1 : 2) ? true : false
type Assert<T extends true> = T

const rows = ko.observableArray([{ label: 'one' }])
const value = useKoValue(rows)

type ArrayValue = Assert<Equal<typeof value, { label: string }[]>>

void (true satisfies ArrayValue)
