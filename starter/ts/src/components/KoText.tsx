import React from 'react'
import ko from 'knockout'
import { KoScope } from 'react-ko'

import styles from '../css/KoText.module.css'

type Props<T> = {
  text: ko.Observable<T> | ko.Computed<T> | T
  color?: ko.Observable<string> | ko.Computed<string> | string
}

export const KoText = React.memo(function KoText<T>({ text, color }: Props<T>) {
  const vm = { text, color }

  return (
    <KoScope viewModel={vm}>
      <span className={styles.text} data-bind="text: text, style: { color: color }"></span>
    </KoScope>
  )
})
