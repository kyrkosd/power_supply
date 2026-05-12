// Topology selection guide tab content for HelpPanel.
import React from 'react'
import styles from './HelpPanel.module.css'

/** Decision tree and per-topology pros/cons reference. */
export function TopologiesTab(): React.ReactElement {
  return (
    <div className={styles.tabContent}>
      <h3>Topology Selection Guide</h3>

      <h4>Decision Tree</h4>
      <pre className={styles.code}>
{`Need Vout < Vin?
  → Buck (step-down)

Need Vout > Vin?
  → Boost (step-up)

Need Vout can be <, >, or = Vin?
  → SEPIC or Buck-Boost (inverting)

Need galvanic isolation?
  → Flyback (low power: <100 W)
  → Forward (high power: >100 W)`}
      </pre>

      <h4>Detailed Topologies</h4>

      <div className={styles.topoCard}>
        <h5>Buck (Step-Down)</h5>
        <p><strong>Applications:</strong> USB PD chargers, computer PSUs, battery chargers.</p>
        <p><strong>Pros:</strong> Simple, low EMI, good efficiency (&gt;90 %).</p>
        <p><strong>Cons:</strong> Output must be lower than input.</p>
        <p><strong>D = Vout / Vin (typical 0.3–0.7).</strong></p>
        <p><strong>Pitfalls:</strong> Forgetting input bulk cap; not sizing Cout for transient response.</p>
      </div>

      <div className={styles.topoCard}>
        <h5>Boost (Step-Up)</h5>
        <p><strong>Applications:</strong> USB-C PD sources, battery-powered tools, solar micro-inverters.</p>
        <p><strong>Pros:</strong> Boosts voltage efficiently.</p>
        <p><strong>Cons:</strong> Output must exceed input; higher EMI; diode carries peak current.</p>
        <p><strong>D ≈ 1 − (Vin / Vout).</strong></p>
        <p><strong>Pitfalls:</strong> Underestimating peak IL = Iout / (1 − D); not derating for DCM.</p>
      </div>

      <div className={styles.topoCard}>
        <h5>Buck-Boost (Inverting)</h5>
        <p><strong>Applications:</strong> Negative rail generation, arbitrary voltage scaling.</p>
        <p><strong>Pros:</strong> Output can be above or below input; flexible.</p>
        <p><strong>Cons:</strong> Inverting output; lower efficiency; more components.</p>
        <p><strong>D = Vout / (Vin + Vout).</strong></p>
        <p><strong>Pitfalls:</strong> Polarity confusion; undersizing both capacitors.</p>
      </div>

      <div className={styles.topoCard}>
        <h5>SEPIC</h5>
        <p><strong>Applications:</strong> Non-inverting buck-boost; battery management.</p>
        <p><strong>Pros:</strong> Non-inverting; flexible output range.</p>
        <p><strong>Cons:</strong> More complex; higher part count.</p>
        <p><strong>Pitfalls:</strong> Forgetting coupling capacitor Cc; not derating Cc for high ripple current.</p>
      </div>

      <div className={styles.topoCard}>
        <h5>Flyback (Isolated)</h5>
        <p><strong>Applications:</strong> Isolated supplies for safety (medical, telecom); &lt;100 W; multiple outputs.</p>
        <p><strong>Pros:</strong> Galvanic isolation; simple (one switch); energy stored in transformer.</p>
        <p><strong>Cons:</strong> Leakage inductance causes voltage spikes; needs clamp/snubber.</p>
        <p><strong>Pitfalls:</strong> Missing clamp snubber; wrong turns ratio; not accounting for core reset.</p>
      </div>

      <div className={styles.topoCard}>
        <h5>Forward</h5>
        <p><strong>Applications:</strong> Isolated, high power &gt;100 W; telecom; server power.</p>
        <p><strong>Pros:</strong> Galvanic isolation; continuous output current; high power capability.</p>
        <p><strong>Cons:</strong> More switches and diodes; complex reset winding.</p>
        <p><strong>Pitfalls:</strong> Miscalculating reset voltage; under-sized output filter.</p>
      </div>
    </div>
  )
}
