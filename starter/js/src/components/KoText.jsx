import React from 'react'
import { KnockoutScope, useKoValue } from 'react-ko'

import styles from '../css/KoText.module.css'

export const KoText = React.memo(function KoText({ text, color }) {
  const vm = { text, color }

  return (
    <KnockoutScope viewModel={vm} boundaryAs="span" as="span">
      <span className={styles.text} data-bind="text: text, style: { color: color }"></span>
    </KnockoutScope>
  )
})

// The same output as KoText, written with useKoValue and plain JSX instead of
// data-bind — the two sanctioned ways to read a Knockout value side by side.
export const KoTextHook = React.memo(function KoTextHook({ text, color }) {
  const value = useKoValue(text)
  const resolvedColor = useKoValue(color)

  return (
    <span className={styles.text} style={{ color: resolvedColor }}>
      {String(value)}
    </span>
  )
})
