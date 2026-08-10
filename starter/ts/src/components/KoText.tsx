import React from 'react'
import ko from 'knockout'
import { KnockoutScope, useKoValue } from 'react-ko'

import styles from '../css/KoText.module.css'

type Props<T> = {
  text: ko.Observable<T> | ko.Computed<T> | T
  color?: ko.Observable<string> | ko.Computed<string> | string
}

export const KoText = React.memo(function KoText<T>({ text, color }: Props<T>) {
  const vm = { text, color }

  return (
    <KnockoutScope viewModel={vm}>
      <span className={styles.text} data-bind="text: text, style: { color: color }"></span>
    </KnockoutScope>
  )
})

// The same output as KoText, written with useKoValue and plain JSX instead of
// data-bind — the two sanctioned ways to read a Knockout value side by side.
export const KoTextHook = React.memo(function KoTextHook<T>({ text, color }: Props<T>) {
  const value = useKoValue(text)
  const resolvedColor = useKoValue(color ?? '')

  return (
    <span className={styles.text} style={{ color: resolvedColor || undefined }}>
      {String(value)}
    </span>
  )
})
