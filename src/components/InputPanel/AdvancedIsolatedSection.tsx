// Advanced controls for flyback/forward (RCD clamp leakage ratio) and boost/buck-boost/SEPIC (sync rect).
import React from 'react'
import { useDesignStore } from '../../store/design-store'
import { Tooltip } from '../Tooltip/Tooltip'
import styles from './InputPanel.module.css'

/**
 * Advanced panel for flyback and forward topologies.
 * Exposes the leakage inductance ratio used to size the RCD clamp network.
 * Returns null for all other topologies so it renders nothing.
 */
export function AdvancedFlybackSection(): React.ReactElement | null {
  const { spec, topology, updateSpec } = useDesignStore()
  if (topology !== 'flyback' && topology !== 'forward') return null

  return (
    <details className={styles.advancedSection}>
      <summary className={styles.advancedTitle}>Advanced</summary>
      <div className={styles.advancedBody}>

        <div className={styles.advancedRow}>
          <label className={styles.advancedLabel}>
            Leakage ratio
            <Tooltip
              content="Transformer leakage inductance as a fraction of magnetising inductance. Typical: 1–3 % for well-coupled transformers. Higher ratio → larger RCD clamp dissipation and MOSFET voltage spike."
              side="right"
            >
              <span className={styles.infoIcon}>ⓘ</span>
            </Tooltip>
          </label>
          <div className={styles.advancedInputGroup}>
            <input
              type="number"
              className={styles.advancedNumberInput}
              value={((spec.leakageRatio ?? 0.02) * 100).toFixed(1)}
              min={0.5}
              max={10}
              step={0.5}
              onChange={(e) => updateSpec({ leakageRatio: Number(e.target.value) / 100 })}
            />
            <span className={styles.advancedUnit}>%</span>
          </div>
        </div>

      </div>
    </details>
  )
}

/**
 * Advanced panel for boost, buck-boost, and SEPIC topologies.
 * Exposes synchronous rectification mode (diode vs sync FET).
 * Returns null for all other topologies so it renders nothing.
 */
export function AdvancedBoostSection(): React.ReactElement | null {
  const { spec, topology, updateSpec } = useDesignStore()
  if (topology !== 'boost' && topology !== 'buck-boost' && topology !== 'sepic') return null

  return (
    <details className={styles.advancedSection}>
      <summary className={styles.advancedTitle}>Advanced</summary>
      <div className={styles.advancedBody}>

        <div className={styles.advancedRow}>
          <label className={styles.advancedLabel}>
            Rectification
            <Tooltip
              content="Synchronous: replaces the freewheeling diode with a low-side MOSFET (Q2). Eliminates 0.7 V diode drop → higher efficiency at heavy load. At light load, gate drive overhead exceeds diode savings — crossover typically at 10–20 % of full load."
              side="right"
            >
              <span className={styles.infoIcon}>ⓘ</span>
            </Tooltip>
          </label>
          <select
            className={styles.advancedSelect}
            value={spec.rectification ?? 'diode'}
            onChange={(e) => updateSpec({ rectification: e.target.value as 'diode' | 'synchronous' })}
          >
            <option value="diode">Diode (async)</option>
            <option value="synchronous">Synchronous FET</option>
          </select>
        </div>

      </div>
    </details>
  )
}
