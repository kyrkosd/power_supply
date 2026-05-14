import React from 'react'
import { METRICS } from './sweepDefs'
import styles from './SweepView.module.css'

interface Props {
  checked:  Set<string>
  onToggle: (key: string) => void
}

export function SweepMetricsRow({ checked, onToggle }: Props): React.ReactElement {
  return (
    <div className={styles.metricsRow}>
      <span className={styles.metricsLabel}>Metrics</span>
      {METRICS.map((m) => (
        <label key={m.key} className={styles.metricCheck}>
          <input type="checkbox" checked={checked.has(m.key)} onChange={() => onToggle(m.key)} />
          <span className={styles.metricDot} style={{ background: m.color }} />
          <span className={styles.metricCheckLabel}>{m.shortLabel}</span>
        </label>
      ))}
    </div>
  )
}
