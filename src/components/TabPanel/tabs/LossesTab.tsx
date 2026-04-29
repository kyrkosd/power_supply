import React from 'react'
import { useWorkbenchStore } from '../../../store/workbenchStore'
import styles from './Tab.module.css'

const LOSS_CATEGORIES = [
  'Switching losses (Esw · fsw)',
  'Conduction losses (I²R)',
  'Gate drive losses',
  'Core losses (Steinmetz)',
  'Diode conduction losses',
  'Capacitor ESR losses'
]

export function LossesTab(): React.ReactElement {
  const { results } = useWorkbenchStore()

  return (
    <div className={styles.tab}>
      <div className={styles.lossGrid}>
        {LOSS_CATEGORIES.map((cat) => (
          <div key={cat} className={styles.lossRow}>
            <span className={styles.lossLabel}>{cat}</span>
            <span className={styles.lossValue}>—</span>
          </div>
        ))}
      </div>
      <div className={styles.note}>
        {results.dutyCycle === null
          ? 'Run simulation to compute loss breakdown.'
          : 'Loss engine not yet implemented.'}
      </div>
    </div>
  )
}
