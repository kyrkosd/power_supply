import React from 'react'
import styles from './Tab.module.css'

const NODES = ['MOSFET junction', 'MOSFET case', 'Heatsink', 'Ambient']

export function ThermalTab(): React.ReactElement {
  return (
    <div className={styles.tab}>
      <div className={styles.lossGrid}>
        {NODES.map((node) => (
          <div key={node} className={styles.lossRow}>
            <span className={styles.lossLabel}>{node}</span>
            <span className={styles.lossValue}>— °C</span>
          </div>
        ))}
      </div>
      <div className={styles.note}>
        Thermal model (Rth chain) — coming soon.
      </div>
    </div>
  )
}
