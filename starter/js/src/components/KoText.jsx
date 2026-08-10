import React from 'react'
import { KoScope } from 'react-ko'

import styles from '../css/KoText.module.css'

export const KoText = React.memo(function KoText({ text, color }) {
  const vm = { text, color }

  return (
    <KoScope viewModel={vm}>
      <span className={styles.text} data-bind="text: text, style: { color: color }"></span>
    </KoScope>
  )
})
