import React, { useState, useEffect } from 'react'
import styles from './HelpPanel.module.css'

type TabId = 'quickstart' | 'results' | 'charts' | 'topologies' | 'shortcuts'

export function HelpPanel(): React.ReactElement {
  const [isOpen, setIsOpen] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('quickstart')

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore modifier keys and don't trigger on inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
      // Open help with "?"
      if (e.key === '?' && !isOpen) {
        e.preventDefault()
        setIsOpen(true)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      const panel = document.getElementById('help-panel')
      const btn = document.getElementById('help-btn')
      if (panel && !panel.contains(e.target as Node) && btn && !btn.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('click', handleClickOutside)
    return () => document.removeEventListener('click', handleClickOutside)
  }, [isOpen])

  return (
    <>
      <button
        id="help-btn"
        className={styles.helpBtn}
        onClick={() => setIsOpen(!isOpen)}
        title="Help & documentation (?)‎"
      >
        ?
      </button>

      {isOpen && (
        <div id="help-panel" className={styles.panel}>
          <div className={styles.header}>
            <h2>Help & Documentation</h2>
            <button className={styles.closeBtn} onClick={() => setIsOpen(false)}>
              ✕
            </button>
          </div>

          <div className={styles.tabBar}>
            {(['quickstart', 'results', 'charts', 'topologies', 'shortcuts'] as TabId[]).map((tab) => (
              <button
                key={tab}
                className={`${styles.tab} ${activeTab === tab ? styles.active : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tabLabel(tab)}
              </button>
            ))}
          </div>

          <div className={styles.content}>
            {activeTab === 'quickstart' && <QuickStartTab />}
            {activeTab === 'results' && <ResultsTab />}
            {activeTab === 'charts' && <ChartsTab />}
            {activeTab === 'topologies' && <TopologiesTab />}
            {activeTab === 'shortcuts' && <ShortcutsTab />}
          </div>
        </div>
      )}
    </>
  )
}

function tabLabel(tab: TabId): string {
  const labels: Record<TabId, string> = {
    quickstart: 'Quick Start',
    results: 'Results',
    charts: 'Charts',
    topologies: 'Topologies',
    shortcuts: 'Shortcuts',
  }
  return labels[tab]
}

// ─────────────────────────────────────────────────────────────────────────────
// QUICK START TAB
// ─────────────────────────────────────────────────────────────────────────────

function QuickStartTab(): React.ReactElement {
  return (
    <div className={styles.tabContent}>
      <h3>Getting Started</h3>
      <ol className={styles.stepList}>
        <li>
          <strong>Select a topology</strong> from the dropdown (Buck, Boost, Buck-Boost, Flyback, Forward, SEPIC).
          Each topology has different voltage and power handling characteristics.
        </li>
        <li>
          <strong>Enter your specifications</strong> in the left panel:
          <ul>
            <li><strong>Vin min/max:</strong> Input voltage range in volts</li>
            <li><strong>Vout:</strong> Desired output voltage in volts</li>
            <li><strong>Iout:</strong> Output current in amps</li>
            <li><strong>Fsw (switching frequency):</strong> Higher = smaller components but more losses (typical: 100 kHz–2 MHz)</li>
            <li><strong>Ripple ratio:</strong> Inductor current ripple as a fraction of output current (0.2–0.4 typical)</li>
          </ul>
        </li>
        <li>
          <strong>Review the results:</strong> The tool calculates component values and efficiency in real time. 
          Watch the Waveforms tab to see if the inductor current stays positive (CCM) or touches zero (DCM).
        </li>
      </ol>

      <h4>Key Abbreviations & Units</h4>
      <table className={styles.table}>
        <tbody>
          <tr>
            <td><strong>D</strong></td>
            <td>Duty cycle (0–1): ratio of switch-on time to switching period</td>
          </tr>
          <tr>
            <td><strong>L</strong></td>
            <td>Inductance in µH (microhenries) or mH (millihenries)</td>
          </tr>
          <tr>
            <td><strong>C</strong></td>
            <td>Capacitance in µF (microfarads) or nF (nanofarads)</td>
          </tr>
          <tr>
            <td><strong>fsw</strong></td>
            <td>Switching frequency in kHz (kilohertz) or MHz (megahertz)</td>
          </tr>
          <tr>
            <td><strong>η (eta)</strong></td>
            <td>Efficiency: percentage of input power delivered to output (goal: &gt;85%)</td>
          </tr>
          <tr>
            <td><strong>PM</strong></td>
            <td>Phase margin: stability indicator (&gt;45° = stable, &lt;30° = risky)</td>
          </tr>
        </tbody>
      </table>

      <h4>App Layout</h4>
      <ul>
        <li><strong>Left panel:</strong> Design inputs and Monte Carlo / Transient controls</li>
        <li><strong>Top right:</strong> Schematic diagram showing your topology</li>
        <li><strong>Bottom right:</strong> Component suggestions (recommended inductor/capacitor parts)</li>
        <li><strong>Tabs:</strong> Waveforms, Bode plot, Loss breakdown, Thermal analysis</li>
      </ul>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// HOW TO READ RESULTS TAB
// ─────────────────────────────────────────────────────────────────────────────

function ResultsTab(): React.ReactElement {
  return (
    <div className={styles.tabContent}>
      <h3>Understanding Results</h3>

      <h4>Component Values</h4>
      <ul>
        <li>
          <strong>L (Inductance):</strong> The main energy storage element. Larger L = smoother current, smaller ripple, 
          but larger physical size. Formula depends on topology (for buck: {`L = Vin × D / (fsw × ΔIL)`}).
        </li>
        <li>
          <strong>Cout (Output Capacitance):</strong> Filters output ripple voltage. Larger Cout = lower ripple but 
          higher cost and size. Typically chosen to meet your ripple spec.
        </li>
        <li>
          <strong>Cin (Input Capacitance):</strong> Reduces input source impedance and provides charge during transients. 
          Must be sized for switching current.
        </li>
      </ul>

      <h4>Duty Cycle (D)</h4>
      <p>
        The ratio of the MOSFET on-time to the switching period. For a buck converter, D = Vout / Vin approximately. 
        For a boost, D relates the voltage conversion ratio. Always 0–1. If D is very close to 1 (e.g., &gt;0.95), 
        look for efficiency loss; D very close to 0 (&lt;0.05) suggests the input voltage is much higher than output.
      </p>

      <h4>Efficiency (%)</h4>
      <p>
        Power delivered to the load divided by power drawn from the supply: η = Pout / Pin × 100%.
        Typical target: &gt;85–90% for most designs. Losses come from:
      </p>
      <ul>
        <li><strong>Conduction loss:</strong> I²R in the MOSFET and diode</li>
        <li><strong>Switching loss:</strong> Energy dissipated during MOSFET transitions</li>
        <li><strong>Core loss:</strong> Hysteresis and eddy-current loss in inductors</li>
        <li><strong>Diode forward voltage drop</strong></li>
      </ul>
      <p>
        Hover over the efficiency result to see a breakdown. To improve: reduce fsw, use lower Rds(on) MOSFET, 
        use Schottky diodes, or upgrade the inductor core material.
      </p>

      <h4>Warnings</h4>
      <p>The tool may show warnings. Common ones:</p>
      <ul>
        <li>
          <strong>Phase margin &lt; 45°:</strong> Your control loop is at risk of oscillation. 
          Increase output capacitance or reduce crossover frequency in the compensator.
        </li>
        <li>
          <strong>Duty cycle out of range:</strong> Your Vin/Vout ratio may be extreme for the chosen topology.
        </li>
        <li>
          <strong>Inductance too small:</strong> Ripple current exceeds 50% of output current; you're in DCM (discontinuous 
          conduction mode). Increase ripple ratio or reduce fsw.
        </li>
        <li>
          <strong>Flyback clamp voltage too high:</strong> Leakage inductance is causing excessive spike. 
          Add a snubber or clamp diode.
        </li>
      </ul>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// INTERPRETING CHARTS TAB
// ─────────────────────────────────────────────────────────────────────────────

function ChartsTab(): React.ReactElement {
  return (
    <div className={styles.tabContent}>
      <h3>Chart Interpretation Guide</h3>

      <h4>Waveforms Tab</h4>
      <p>Shows 4 key waveforms over one or more switching cycles:</p>
      <ul>
        <li>
          <strong>IL (Inductor Current):</strong> Should be triangular, oscillating around the average output current.
          {' '}
          <em>Healthy:</em> IL stays positive and ripple is steady. 
          <em>Problem:</em> IL touches zero or goes negative = Discontinuous Conduction Mode (DCM); 
          your ripple ratio is too high or fsw too low.
        </li>
        <li>
          <strong>Vsw (Switch Voltage):</strong> The MOSFET drain-source voltage. Should go from near 0V (on) to 
          near Vin or higher (off). Watch for excessive voltage spikes in flyback or isolated topologies—that's leakage inductance.
        </li>
        <li>
          <strong>Vout (Output Voltage):</strong> Should be nearly flat. The peak-to-peak ripple is 
          ΔVout. If too high, increase Cout.
        </li>
        <li>
          <strong>ID (Diode Current):</strong> Non-overlapping with IL; when IL goes to zero, ID carries the freewheeling current.
        </li>
      </ul>

      <h4>Bode Plot Tab</h4>
      <p>
        Shows the frequency response of your power supply's control loop (plant + compensator).
        Three lines:
      </p>
      <ul>
        <li>
          <strong>Magnitude (top):</strong> How much the output responds to disturbances.
          Should be high at DC (low frequency) so output voltage is stiff. Should roll off above crossover.
        </li>
        <li>
          <strong>Phase (bottom):</strong> Time delay through the loop. At the crossover frequency
          (where magnitude = 0 dB), the phase should be &gt; −135° (or &gt;45° phase margin).
          If phase drops below −180°, the loop is unstable and will oscillate.
        </li>
        <li>
          <strong>Crossover frequency:</strong> Where magnitude crosses 0 dB. This is your bandwidth.
          Higher = faster response but more susceptible to high-frequency noise.
        </li>
      </ul>

      <h4>Voltage Mode vs Current Mode (Buck only)</h4>
      <p>
        Switch between the two control architectures using the <strong>Advanced → Control Mode</strong>{' '}
        dropdown in the input panel:
      </p>
      <ul>
        <li>
          <strong>Voltage Mode (VMC):</strong> The duty cycle is controlled directly by comparing a
          voltage-error signal to a fixed sawtooth ramp. The plant has an <em>LC double pole</em> that
          causes a −180° phase drop at the resonant frequency — a Type-II (or Type-III) compensator
          must add phase boost to avoid instability. This is the default.
        </li>
        <li>
          <strong>Current Mode (PCM — Peak Current Mode):</strong> An inner current loop senses the
          inductor current on every cycle and limits peak current directly. The outer voltage loop sees
          the inner loop as a controlled current source, so the inductor pole <em>disappears</em> from
          the plant. The result is a first-order (single-pole) plant that is much easier to stabilise:
          a Type-II compensator is typically sufficient and achieves wider bandwidth.
        </li>
      </ul>
      <p>
        <strong>Subharmonic oscillation (D &gt; 50 %):</strong> In peak current mode, when duty cycle
        exceeds 50 % the converter can exhibit a period-doubling instability called subharmonic
        oscillation (at fsw/2). The cure is <em>slope compensation</em> — adding an external ramp to
        the current-sense signal. The tool shows a warning band and reports the minimum required ramp
        slope Se (in A/s, multiply by your Rsense in Ω to get V/s). A common rule of thumb is
        Se ≥ Vout / (2L), which is the value shown. See Erickson &amp; Maksimovic §11.3 for the full
        derivation.
      </p>

      <h4>Loss Breakdown Tab</h4>
      <p>Pie chart showing where power is wasted:</p>
      <ul>
        <li><strong>Switching loss:</strong> Energy during MOSFET turn-on/off. Reduce by lowering fsw or using faster switching ICs.</li>
        <li><strong>Conduction loss:</strong> Resistive heating in MOSFET and diode. Reduce by choosing lower Rds(on) or Schottky.</li>
        <li><strong>Core loss:</strong> Hysteresis in the inductor. Reduce by using higher-permeability cores or lower density.</li>
        <li><strong>Winding loss:</strong> DCR (inductor resistance). Reduce by using thicker wire or larger cross-section.</li>
      </ul>
      <p>
        Click on a slice to see recommendations for that component. For example, if switching loss dominates, 
        try reducing fsw or upgrading the MOSFET.
      </p>

      <h4>Thermal Tab</h4>
      <p>
        Shows estimated junction temperature of your MOSFET and diode based on ambient temperature and calculated losses.
      </p>
      <ul>
        <li><strong>Green:</strong> Safe (&lt;100°C); no heatsink needed.</li>
        <li><strong>Yellow:</strong> Warm (100–125°C); consider a small heatsink.</li>
        <li><strong>Red:</strong> Hot (&gt;125°C); add a heatsink or reduce operating conditions.</li>
      </ul>
      <p>
        Formula: Tj = Ta + (Pdiss × θJA), where Ta is ambient, Pdiss is dissipated power, and θJA is junction-to-ambient thermal resistance.
      </p>

      <h4>Monte Carlo Tab (if available)</h4>
      <p>
        Shows the distribution of results (e.g., efficiency, phase margin) across 1000+ simulations with 
        component tolerances randomly varied (e.g., ±10% capacitor, ±5% inductor).
      </p>
      <ul>
        <li>Red region = worst-case, Yellow = typical, Green = best-case.</li>
        <li>If the red region violates your spec, consider tighter tolerances or de-rating.</li>
      </ul>

      <h4>Transient Tab (if available)</h4>
      <p>
        Simulates the output voltage step response when load current suddenly increases or decreases. 
        Watch for overshoot (voltage spike) or undershoot. Phase margin correlates with transient response.
      </p>

      <h4>EMI Tab (if available)</h4>
      <p>
        Estimates radiated and conducted EMI based on switching frequency, slew rate, and circuit layout. 
        Compares against FCC Part 15 or EN 55011 limits. If you exceed limits, reduce dI/dt with snubbers 
        or add EMI filtering.
      </p>

      <h4>LTspice Comparison Tab (if available)</h4>
      <p>
        Overlays this tool's analytical waveforms against a detailed SPICE simulation from LTspice. 
        Useful for validating assumptions or checking parasitics.
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// TOPOLOGIES TAB
// ─────────────────────────────────────────────────────────────────────────────

function TopologiesTab(): React.ReactElement {
  return (
    <div className={styles.tabContent}>
      <h3>Topology Selection Guide</h3>

      <h4>Decision Tree</h4>
      <pre className={styles.code}>
Need Vout &lt; Vin?
  → Buck (step-down)

Need Vout &gt; Vin?
  → Boost (step-up)

Need Vout can be &lt;, &gt;, or = Vin?
  → SEPIC or Buck-Boost (inverting)

Need galvanic isolation (input ≠ output ground)?
  → Flyback (low power: &lt;100W)
  → Forward (high power: &gt;100W)
  → LLC (high efficiency, but more complex)
      </pre>

      <h4>Detailed Topologies</h4>

      <div className={styles.topoCard}>
        <h5>Buck (Step-Down)</h5>
        <p><strong>Applications:</strong> Most common. USB PD chargers, computer power supplies, battery chargers.</p>
        <p><strong>Pros:</strong> Simple, low EMI, good efficiency (&gt;90%), input diode conducts during freewheeling.</p>
        <p><strong>Cons:</strong> Output voltage must be lower than input.</p>
        <p><strong>Duty cycle:</strong> D = Vout / Vin (typical 0.3–0.7).</p>
        <p><strong>Common mistakes:</strong> Forgetting input bulk capacitor; not sizing output cap for transient response.</p>
      </div>

      <div className={styles.topoCard}>
        <h5>Boost (Step-Up)</h5>
        <p><strong>Applications:</strong> USB-C PD sources, battery-powered tools, solar micro-inverters.</p>
        <p><strong>Pros:</strong> Boosts voltage; switch-mode regulators for higher voltage rails.</p>
        <p><strong>Cons:</strong> Output voltage must be higher than input; higher EMI; diode carries peak current.</p>
        <p><strong>Duty cycle:</strong> D ≈ 1 − (Vin / Vout).</p>
        <p><strong>Common mistakes:</strong> Underestimating inductor current (peak = Iout / (1 − D)); not derating for DCM.</p>
      </div>

      <div className={styles.topoCard}>
        <h5>Buck-Boost (Inverting)</h5>
        <p><strong>Applications:</strong> Negative rail generation, arbitrary voltage scaling.</p>
        <p><strong>Pros:</strong> Output voltage can be above or below input; flexible.</p>
        <p><strong>Cons:</strong> Inverting (Vout &lt; 0 relative to input ground); lower efficiency; more components.</p>
        <p><strong>Duty cycle:</strong> D = Vout / (Vin + Vout).</p>
        <p><strong>Common mistakes:</strong> Confusion about polarity; undersizing both capacitors.</p>
      </div>

      <div className={styles.topoCard}>
        <h5>SEPIC</h5>
        <p><strong>Applications:</strong> Non-inverting buck-boost; battery management where output &lt;, &gt;, or = input.</p>
        <p><strong>Pros:</strong> Non-inverting; two capacitors (Cin, Cc, Cout) reduce voltage stress; flexible.</p>
        <p><strong>Cons:</strong> More complex; more components; higher part count and cost.</p>
        <p><strong>Duty cycle:</strong> Similar to buck-boost but non-inverting.</p>
        <p><strong>Common mistakes:</strong> Forgetting the coupling capacitor Cc; not derating Cc for high current ripple.</p>
      </div>

      <div className={styles.topoCard}>
        <h5>Flyback (Isolated)</h5>
        <p><strong>Applications:</strong> Isolated supplies for safety (medical, telecom); low power &lt;100W; multiple outputs.</p>
        <p><strong>Pros:</strong> Galvanic isolation; simple (one switch); energy transfer via transformer.</p>
        <p><strong>Cons:</strong> Transformer leakage inductance causes voltage spikes; needs clamp/snubber; harder to analyze.</p>
        <p><strong>Common mistakes:</strong>
          <ul>
            <li>Forgetting the clamp snubber for leakage inductance.</li>
            <li>Using wrong turns ratio → unstable duty cycle.</li>
            <li>Not accounting for core reset during off-time.</li>
          </ul>
        </p>
      </div>

      <div className={styles.topoCard}>
        <h5>Forward</h5>
        <p><strong>Applications:</strong> Isolated, high power &gt;100W; main processor supplies; telecom.</p>
        <p><strong>Pros:</strong> Galvanic isolation; continuous output current (not reset-limited); high power capability.</p>
        <p><strong>Cons:</strong> More switches and diodes; complex reset winding; expensive transformer.</p>
        <p><strong>Common mistakes:</strong>
          <ul>
            <li>Miscalculating reset voltage → violates MOSFET rating.</li>
            <li>Not synchronizing reset with secondary rectifier.</li>
            <li>Under-sized output filter.</li>
          </ul>
        </p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// KEYBOARD SHORTCUTS TAB
// ─────────────────────────────────────────────────────────────────────────────

function ShortcutsTab(): React.ReactElement {
  return (
    <div className={styles.tabContent}>
      <h3>Keyboard Shortcuts</h3>
      <table className={styles.table}>
        <tbody>
          <tr>
            <td><kbd>?</kbd></td>
            <td>Open / close Help panel</td>
          </tr>
          <tr>
            <td><kbd>Ctrl+1</kbd></td>
            <td>Show Waveforms tab</td>
          </tr>
          <tr>
            <td><kbd>Ctrl+2</kbd></td>
            <td>Show Bode plot tab</td>
          </tr>
          <tr>
            <td><kbd>Ctrl+3</kbd></td>
            <td>Show Loss breakdown tab</td>
          </tr>
          <tr>
            <td><kbd>Ctrl+4</kbd></td>
            <td>Show Thermal tab</td>
          </tr>
          <tr>
            <td><kbd>Esc</kbd></td>
            <td>Close Help panel</td>
          </tr>
        </tbody>
      </table>

      <p style={{ marginTop: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
        Pro tip: Use Ctrl+1–4 to quickly navigate between analysis tabs while designing.
      </p>
    </div>
  )
}
