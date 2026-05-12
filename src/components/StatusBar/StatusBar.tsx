// Status bar: topology name, key results summary (D, L, C, η, operating mode), and warning count.
import React from 'react'
import { useDesignStore } from '../../store/design-store'
import styles from './StatusBar.module.css'

const TOPOLOGY_LABELS: Record<string, string> = {
  buck: 'Buck', boost: 'Boost', 'buck-boost': 'Buck-Boost',
  flyback: 'Flyback', forward: 'Forward', sepic: 'SEPIC',
}

/** Map operating mode string to a status colour. */
function modeColor(mode?: string): string {
  if (mode === 'CCM')      return '#4ade80'
  if (mode === 'boundary') return '#fbbf24'
  if (mode === 'DCM')      return '#f87171'
  return 'var(--text-secondary)'
}

/** Thin footer bar showing topology, key results, and warning badge. */
export function StatusBar(): React.ReactElement {
  const { topology, result } = useDesignStore()
  const warningCount = result?.warnings?.length ?? 0

  return (
    <div className={styles.statusBar}>
      {/* Topology label */}
      <div className={styles.section}>
        <span className={styles.label}>Topology:</span>
        <span className={styles.value}>{TOPOLOGY_LABELS[topology]}</span>
      </div>

      {/* Key results summary */}
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
            {result.operating_mode && (
              <span className={styles.resultItem}>
                <span className={styles.resultLabel}>Mode</span>
                <span
                  className={styles.resultValue}
                  style={{ color: modeColor(result.operating_mode) }}
                  title={`CCM/DCM boundary: ${(result.ccm_dcm_boundary ?? 0).toFixed(3)} A`}
                >
                  {result.operating_mode}
                </span>
              </span>
            )}
          </>
        ) : (
          <span className={styles.placeholder}>—</span>
        )}
      </div>

      {/* Warning badge */}
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
