// Topology selection guide tab content for the HelpPanel.
import React from 'react'
import styles from './HelpPanel.module.css'
import { TOPO_DATA, TopoCard } from './helpPanelUtils'

const DECISION_TREE = `Need Vout < Vin?
  → Buck (step-down)

Need Vout > Vin?
  → Boost (step-up)

Need Vout can be <, >, or = Vin?
  → SEPIC or Buck-Boost (inverting)

Need galvanic isolation?
  → Flyback (low power: <100 W)
  → Forward (high power: >100 W)`

/**
 * Tab 4: topology decision tree and per-topology reference cards
 * covering applications, pros, cons, duty cycle, and common pitfalls.
 */
export function TopologiesTab(): React.ReactElement {
  return (
    <div className={styles.tabContent}>
      <h3>Topology Selection Guide</h3>
      <h4>Decision Tree</h4>
      <pre className={styles.code}>{DECISION_TREE}</pre>
      <h4>Detailed Topologies</h4>
      {TOPO_DATA.map((t) => <TopoCard key={t.name} t={t} />)}
    </div>
  )
}
