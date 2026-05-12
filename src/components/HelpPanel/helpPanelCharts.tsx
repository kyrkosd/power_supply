// Charts interpretation tab content for the HelpPanel.
import React from 'react'
import styles from './HelpPanel.module.css'

// ── Section sub-components ────────────────────────────────────────────────────

/** Waveforms tab interpretation: IL, Vsw, Vout, and diode current signals. */
function WaveformsSection(): React.ReactElement {
  return (
    <>
      <h4>Waveforms Tab</h4>
      <ul>
        <li><strong>IL (Inductor Current):</strong> Triangular, oscillating around average Iout. <em>Healthy:</em> stays positive. <em>Problem:</em> touches zero = DCM — ripple ratio too high or fsw too low.</li>
        <li><strong>Vsw (Switch Voltage):</strong> Near 0 V (on) to near Vin (off). Excessive spikes in flyback = leakage inductance.</li>
        <li><strong>Vout:</strong> Nearly flat; peak-to-peak = ΔVout ripple. If too high, increase Cout.</li>
        <li><strong>ID (Diode Current):</strong> Non-overlapping with IL; carries freewheeling current when IL = 0.</li>
      </ul>
    </>
  )
}

/** Bode plot tab interpretation: magnitude, phase, and crossover frequency. */
function BodeSection(): React.ReactElement {
  return (
    <>
      <h4>Bode Plot Tab</h4>
      <p>Frequency response of the control loop (plant + compensator):</p>
      <ul>
        <li><strong>Magnitude:</strong> High at DC (stiff output), rolls off above crossover.</li>
        <li><strong>Phase:</strong> At 0 dB crossover, phase must be &gt; −135° (≥ 45° PM). Below −180° = unstable.</li>
        <li><strong>Crossover frequency:</strong> Where magnitude = 0 dB. Higher = faster response, more noise susceptibility.</li>
      </ul>
    </>
  )
}

/** Voltage mode vs current mode control comparison and subharmonic oscillation note. */
function ControlModeSection(): React.ReactElement {
  return (
    <>
      <h4>Voltage Mode vs Current Mode (Buck only)</h4>
      <ul>
        <li><strong>Voltage Mode (VMC):</strong> Duty cycle controlled by error-to-ramp comparison. Plant has LC double pole causing −180° phase drop at resonance — Type-II/III compensator needed.</li>
        <li><strong>Current Mode (PCM):</strong> Inner current loop senses inductor current cycle-by-cycle. Inductor pole disappears from the plant → first-order plant, wider bandwidth, simpler compensation.</li>
      </ul>
      <p>
        <strong>Subharmonic oscillation (D &gt; 50 %):</strong> In PCM, D &gt; 0.5 causes period-doubling instability.
        Cure: slope compensation — external ramp added to the current-sense signal.
        Minimum ramp slope Se ≥ Vout / (2L) (Erickson &amp; Maksimovic §11.3).
      </p>
    </>
  )
}

/** Loss breakdown tab: switching, conduction, core, and winding losses. */
function LossSection(): React.ReactElement {
  return (
    <>
      <h4>Loss Breakdown Tab</h4>
      <ul>
        <li><strong>Switching loss:</strong> During MOSFET transitions — reduce by lowering fsw or using faster gate drivers.</li>
        <li><strong>Conduction loss:</strong> Resistive I²R heating — reduce by lower Rds(on) or Schottky diodes.</li>
        <li><strong>Core loss:</strong> Hysteresis in the inductor — reduce by higher-permeability cores.</li>
        <li><strong>Winding loss:</strong> DCR — reduce by thicker wire or larger cross-section.</li>
      </ul>
    </>
  )
}

/** Thermal tab: junction temperature estimation and colour-coded safe zones. */
function ThermalSection(): React.ReactElement {
  return (
    <>
      <h4>Thermal Tab</h4>
      <p>Estimated junction temperature: Tj = Ta + (Pdiss × θJA).</p>
      <ul>
        <li><strong>Green:</strong> &lt; 100 °C — no heatsink needed.</li>
        <li><strong>Yellow:</strong> 100–125 °C — consider a small heatsink.</li>
        <li><strong>Red:</strong> &gt; 125 °C — add heatsink or reduce operating conditions.</li>
      </ul>
    </>
  )
}

/** Monte Carlo, Transient, EMI, and LTspice tab summaries. */
function AdvancedTabsSection(): React.ReactElement {
  return (
    <>
      <h4>Monte Carlo Tab</h4>
      <p>Distribution of results across 1000+ simulations with component tolerances randomly varied (±10 % cap, ±5 % inductor).</p>
      <ul>
        <li>Red region = worst-case, Yellow = typical, Green = best-case.</li>
        <li>If the red region violates your spec, consider tighter tolerances or de-rating.</li>
      </ul>
      <h4>Transient Tab</h4>
      <p>RK4 state-space simulation of the output voltage step response at startup, load step, or line step. Monitor overshoot and settling time — both correlate with phase margin.</p>
      <h4>EMI Tab</h4>
      <p>Estimates conducted emissions from switching frequency, slew rate, and layout parasitics. Compares against CISPR 32 Class B limits. If limits are exceeded, add snubbers or an input EMI filter.</p>
      <h4>LTspice Comparison Tab</h4>
      <p>Overlays analytical waveforms against a detailed SPICE simulation from LTspice — useful for validating assumptions or checking parasitics not modelled analytically.</p>
    </>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────

/** Tab 3: guides for reading waveforms, Bode plot, loss breakdown, thermal, MC, transient, EMI, and LTspice tabs. */
export function ChartsTab(): React.ReactElement {
  return (
    <div className={styles.tabContent}>
      <h3>Chart Interpretation Guide</h3>
      <WaveformsSection />
      <BodeSection />
      <ControlModeSection />
      <LossSection />
      <ThermalSection />
      <AdvancedTabsSection />
    </div>
  )
}
