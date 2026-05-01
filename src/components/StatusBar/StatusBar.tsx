import React from 'react'
import { useDesignStore } from '../../store/design-store'
import styles from './StatusBar.module.css'

export function StatusBar(): React.ReactElement {
  const { topology, result } = useDesignStore()

  const warningCount = result?.warnings?.length ?? 0

  const topologyLabel: Record<string, string> = {
    buck: 'Buck',
    boost: 'Boost',
    'buck-boost': 'Buck-Boost',
    flyback: 'Flyback',
    forward: 'Forward',
    sepic: 'SEPIC',
  }

  return (
    <div className={styles.statusBar}>
      {/* Left: topology name */}
      <div className={styles.section}>
        <span className={styles.label}>Topology:</span>
        <span className={styles.value}>{topologyLabel[topology]}</span>
      </div>

      {/* Center: key results summary */}
      <div className={styles.section}>
        {result ? (
          <>
            <span className={styles.resultItem}>
              <span className={styles.resultLabel}>D</span>
              <span className={styles.resultValue}>{(result.dutyCycle * 100).toFixed(1)}%</span>
            </span>
            <span className={styles.resultItem}>
              <span className={styles.resultLabel}>L</span>
              <span className={styles.resultValue}>{(result.inductance * 1e6).toFixed(2)}µH</span>
            </span>
            <span className={styles.resultItem}>
              <span className={styles.resultLabel}>C</span>
              <span className={styles.resultValue}>{(result.capacitance * 1e6).toFixed(1)}µF</span>
            </span>
            {result.efficiency != null && (
              <span className={styles.resultItem}>
                <span className={styles.resultLabel}>η</span>
                <span className={styles.resultValue}>{(result.efficiency * 100).toFixed(1)}%</span>
              </span>
            )}
          </>
        ) : (
          <span className={styles.placeholder}>—</span>
        )}
      </div>

      {/* Right: compute time & warnings */}
      <div className={styles.section}>
        {warningCount > 0 && (
          <span
            className={styles.warningBadge}
            title={`${warningCount} warning${warningCount !== 1 ? 's' : ''}`}
          >
            ⚠ {warningCount}
          </span>
        )}
      </div>
    </div>
  )
}
