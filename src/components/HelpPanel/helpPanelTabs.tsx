// Quick Start, Results, and Shortcuts tab content for HelpPanel.
import React from 'react'
import styles from './HelpPanel.module.css'

export type TabId = 'quickstart' | 'results' | 'charts' | 'topologies' | 'shortcuts'

const TAB_LABELS: Record<TabId, string> = {
  quickstart: 'Quick Start', results: 'Results', charts: 'Charts',
  topologies: 'Topologies',  shortcuts: 'Shortcuts',
}

/** Display label for a tab id. */
export function tabLabel(tab: TabId): string { return TAB_LABELS[tab] }

// ── Quick Start ───────────────────────────────────────────────────────────────

export function QuickStartTab(): React.ReactElement {
  return (
    <div className={styles.tabContent}>
      <div style={{ background: 'rgba(50,201,230,0.07)', border: '1px solid rgba(50,201,230,0.2)', borderRadius: 6, padding: '9px 12px', marginBottom: 14, fontSize: 12, lineHeight: 1.5 }}>
        <strong style={{ color: '#32c9e6' }}>New to the app?</strong> Open the{' '}
        <strong>Design Library</strong> (<kbd style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 3, padding: '1px 5px', fontSize: 11 }}>Ctrl+L</kbd>) and load a reference design — 12 real-world examples from beginner to advanced.
      </div>
      <h3>Getting Started</h3>
      <ol className={styles.stepList}>
        <li><strong>Select a topology</strong> from the dropdown (Buck, Boost, Buck-Boost, Flyback, Forward, SEPIC).</li>
        <li>
          <strong>Enter your specifications</strong> in the left panel:
          <ul>
            <li><strong>Vin min/max:</strong> Input voltage range in volts</li>
            <li><strong>Vout:</strong> Desired output voltage in volts</li>
            <li><strong>Iout:</strong> Output current in amps</li>
            <li><strong>Fsw:</strong> Switching frequency — higher = smaller components but more losses (100 kHz–2 MHz typical)</li>
            <li><strong>Ripple ratio:</strong> Inductor current ripple as a fraction of output current (0.2–0.4 typical)</li>
          </ul>
        </li>
        <li><strong>Review the results:</strong> Component values and efficiency update in real time. Watch the Waveforms tab to see if the inductor current stays positive (CCM) or touches zero (DCM).</li>
      </ol>
      <h4>Key Abbreviations &amp; Units</h4>
      <table className={styles.table}>
        <tbody>
          <tr><td><strong>D</strong></td><td>Duty cycle (0–1): ratio of switch-on time to switching period</td></tr>
          <tr><td><strong>L</strong></td><td>Inductance in µH (microhenries) or mH (millihenries)</td></tr>
          <tr><td><strong>C</strong></td><td>Capacitance in µF (microfarads) or nF (nanofarads)</td></tr>
          <tr><td><strong>fsw</strong></td><td>Switching frequency in kHz or MHz</td></tr>
          <tr><td><strong>η (eta)</strong></td><td>Efficiency: output power / input power × 100 % (goal: &gt;85 %)</td></tr>
          <tr><td><strong>PM</strong></td><td>Phase margin: stability indicator (&gt;45° = stable, &lt;30° = risky)</td></tr>
        </tbody>
      </table>
      <h4>App Layout</h4>
      <ul>
        <li><strong>Left panel:</strong> Design inputs and Monte Carlo / Transient controls</li>
        <li><strong>Top right:</strong> Schematic diagram for your topology</li>
        <li><strong>Bottom right:</strong> Component suggestions (recommended inductor/capacitor parts)</li>
        <li><strong>Tabs:</strong> Waveforms, Bode plot, Loss breakdown, Thermal analysis</li>
      </ul>
    </div>
  )
}

// ── Results ───────────────────────────────────────────────────────────────────

export function ResultsTab(): React.ReactElement {
  return (
    <div className={styles.tabContent}>
      <h3>Understanding Results</h3>
      <h4>Component Values</h4>
      <ul>
        <li><strong>L (Inductance):</strong> Main energy-storage element. Larger L = smoother current, smaller ripple, bigger size. For buck: {`L = Vin × D / (fsw × ΔIL)`}.</li>
        <li><strong>Cout:</strong> Filters output ripple. Larger = lower ripple but higher cost and size.</li>
        <li><strong>Cin:</strong> Reduces input source impedance; sized for switching current.</li>
      </ul>
      <h4>Duty Cycle (D)</h4>
      <p>Ratio of MOSFET on-time to the switching period. For buck: D ≈ Vout / Vin. Always 0–1. D &gt; 0.95 often signals efficiency loss; D &lt; 0.05 suggests an extreme voltage ratio.</p>
      <h4>Efficiency (%)</h4>
      <p>η = Pout / Pin × 100 %. Losses come from:</p>
      <ul>
        <li><strong>Conduction loss:</strong> I²R in the MOSFET and diode</li>
        <li><strong>Switching loss:</strong> Energy during MOSFET transitions</li>
        <li><strong>Core loss:</strong> Hysteresis and eddy-current loss in inductors</li>
        <li><strong>Diode forward drop</strong></li>
      </ul>
      <p>To improve: reduce fsw, use lower Rds(on) MOSFET, use Schottky diodes, or upgrade the inductor core material.</p>
      <h4>Common Warnings</h4>
      <ul>
        <li><strong>Phase margin &lt; 45°:</strong> Control loop at risk of oscillation — increase Cout or reduce crossover frequency.</li>
        <li><strong>Duty cycle out of range:</strong> Vin/Vout ratio may be extreme for the chosen topology.</li>
        <li><strong>Inductance too small:</strong> Ripple &gt; 50 % of Iout — you're in DCM. Increase ripple ratio or reduce fsw.</li>
        <li><strong>Flyback clamp voltage too high:</strong> Add a snubber or clamp diode.</li>
      </ul>
    </div>
  )
}

// ── Shortcuts ─────────────────────────────────────────────────────────────────

export function ShortcutsTab(): React.ReactElement {
  return (
    <div className={styles.tabContent}>
      <h3>Keyboard Shortcuts</h3>
      <table className={styles.table}>
        <tbody>
          <tr><td><kbd>?</kbd></td><td>Open / close Help panel</td></tr>
          <tr><td><kbd>Ctrl+1</kbd></td><td>Show Waveforms tab</td></tr>
          <tr><td><kbd>Ctrl+2</kbd></td><td>Show Bode plot tab</td></tr>
          <tr><td><kbd>Ctrl+3</kbd></td><td>Show Loss breakdown tab</td></tr>
          <tr><td><kbd>Ctrl+4</kbd></td><td>Show Thermal tab</td></tr>
          <tr><td><kbd>Ctrl+K</kbd></td><td>Save current design as Design A for comparison</td></tr>
          <tr><td><kbd>Ctrl+Shift+K</kbd></td><td>Open side-by-side design comparison</td></tr>
          <tr><td><kbd>Ctrl+L</kbd></td><td>Open Design Library</td></tr>
          <tr><td><kbd>Esc</kbd></td><td>Close Help panel</td></tr>
        </tbody>
      </table>
      <p style={{ marginTop: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
        Pro tip: Use Ctrl+1–4 to quickly navigate between analysis tabs while designing.
      </p>
    </div>
  )
}
