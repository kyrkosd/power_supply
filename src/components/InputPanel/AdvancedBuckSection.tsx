// Advanced controls for Buck topology: interleaved phases, sync rectification, control mode, current sensing.
import React from 'react'
import { useDesignStore } from '../../store/design-store'
import { Tooltip } from '../Tooltip/Tooltip'
import styles from './InputPanel.module.css'

/** Advanced settings panel rendered only when the active topology is Buck. */
export function AdvancedBuckSection(): React.ReactElement {
  const { spec, updateSpec } = useDesignStore()
  const controlMode = spec.controlMode ?? 'voltage'
  const senseMethod = spec.senseMethod ?? 'resistor'

  return (
    <details className={styles.advancedSection}>
      <summary className={styles.advancedTitle}>Advanced</summary>
      <div className={styles.advancedBody}>

        <div className={styles.advancedRow}>
          <label className={styles.advancedLabel}>
            Phases
            <Tooltip content="Number of interleaved phases (1–6). Each phase is a buck stage phase-shifted by 360°/N. More phases → smaller per-phase L, smaller Cout, lower conduction losses. Perfect ripple cancellation at D = k/N." side="right">
              <span className={styles.infoIcon}>ⓘ</span>
            </Tooltip>
          </label>
          <select className={styles.advancedSelect} value={spec.phases ?? 1} onChange={(e) => updateSpec({ phases: Number(e.target.value) })}>
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <option key={n} value={n}>{n === 1 ? '1 phase (standard)' : `${n} phases`}</option>
            ))}
          </select>
        </div>

        <div className={styles.advancedRow}>
          <label className={styles.advancedLabel}>
            Rectification
            <Tooltip content="Synchronous: replaces the freewheeling diode with a low-side MOSFET (Q2). Eliminates 0.7 V drop → higher efficiency at heavy load. Crossover with diode mode typically at 10–20 % of Iout. Requires dead-time control." side="right">
              <span className={styles.infoIcon}>ⓘ</span>
            </Tooltip>
          </label>
          <select className={styles.advancedSelect} value={spec.rectification ?? 'diode'} onChange={(e) => updateSpec({ rectification: e.target.value as 'diode' | 'synchronous' })}>
            <option value="diode">Diode (async)</option>
            <option value="synchronous">Synchronous FET</option>
          </select>
        </div>

        <div className={styles.advancedRow}>
          <label className={styles.advancedLabel}>
            Control mode
            <Tooltip content="Voltage mode: Type-II compensator, LC double pole in plant. Current mode (PCM): inner current loop removes the inductor pole — single-pole plant, simpler compensation, better line rejection. Requires slope comp at D > 50 %." side="right">
              <span className={styles.infoIcon}>ⓘ</span>
            </Tooltip>
          </label>
          <select className={styles.advancedSelect} value={controlMode} onChange={(e) => updateSpec({ controlMode: e.target.value as 'voltage' | 'current' })}>
            <option value="voltage">Voltage Mode (VMC)</option>
            <option value="current">Current Mode (PCM)</option>
          </select>
        </div>

        {controlMode === 'current' && (
          <>
            <div className={styles.advancedRow}>
              <label className={styles.advancedLabel}>
                Sense method
                <Tooltip content="Resistor: dedicated shunt; accurate, low temperature drift. Rds(on): uses MOSFET on-resistance; lossless but ±30 % accuracy variation from 25 °C to 100 °C." side="right">
                  <span className={styles.infoIcon}>ⓘ</span>
                </Tooltip>
              </label>
              <select className={styles.advancedSelect} value={senseMethod} onChange={(e) => updateSpec({ senseMethod: e.target.value as 'resistor' | 'rdson' })}>
                <option value="resistor">Sense Resistor</option>
                <option value="rdson">Rds(on) (lossless)</option>
              </select>
            </div>
            {senseMethod === 'resistor' && (
              <div className={styles.advancedRow}>
                <label className={styles.advancedLabel}>
                  Vsense target (mV)
                  <Tooltip content="Peak voltage across Rsense at maximum load. Higher = better SNR but more Rsense dissipation. Typical: 100–200 mV. Below 50 mV: poor noise margin. Above 300 mV: excessive losses." side="right">
                    <span className={styles.infoIcon}>ⓘ</span>
                  </Tooltip>
                </label>
                <input
                  type="number" className={styles.advancedSelect}
                  min={20} max={500} step={10}
                  value={spec.vsenseTargetMv ?? 150}
                  onChange={(e) => updateSpec({ vsenseTargetMv: Math.max(20, Math.min(500, Number(e.target.value))) })}
                />
              </div>
            )}
          </>
        )}
      </div>
    </details>
  )
}
