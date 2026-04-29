import React from 'react'
import { useDesignStore, TopologyId } from '../../store/design-store'
import styles from './Toolbar.module.css'

const TOPOLOGIES: { id: TopologyId; label: string }[] = [
  { id: 'buck',      label: 'Buck (Step-Down)' },
  { id: 'boost',     label: 'Boost (Step-Up)' },
  { id: 'buck-boost',label: 'Buck-Boost' },
  { id: 'flyback',   label: 'Flyback' },
  { id: 'forward',   label: 'Forward' },
  { id: 'sepic',     label: 'SEPIC' }
]

export function Toolbar(): React.ReactElement {
  const { topology, setTopology } = useDesignStore()

  return (
    <header className={styles.toolbar}>
      <div className={styles.brand}>
        <span className={styles.logo}>⚡</span>
        <span className={styles.title}>Power Supply Workbench</span>
      </div>

      <div className={styles.controls}>
        <label className={styles.label} htmlFor="topology-select">
          Topology
        </label>
        <select
          id="topology-select"
          className={styles.select}
          value={topology}
          onChange={(e) => setTopology(e.target.value as TopologyId)}
        >
          {TOPOLOGIES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.spacer} />

      <div className={styles.actions}>
        <button className={styles.btn} disabled title="Run simulation (coming soon)">
          ▶ Simulate
        </button>
        <button className={styles.btn} disabled title="Export report (coming soon)">
          ↓ Export
        </button>
      </div>
    </header>
  )
}
