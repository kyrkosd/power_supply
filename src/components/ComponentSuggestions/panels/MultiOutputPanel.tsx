// Flyback multi-output cross-regulation summary table.
import React from 'react'
import type { DesignResult } from '../../../engine/types'
import styles from '../ComponentSuggestions.module.css'

type SecondaryResult = NonNullable<DesignResult['secondaryOutputResults']>[number]

function regulationCell(s: SecondaryResult): React.ReactElement {
  return s.crossRegPct > 0
    ? <td className={styles.moCrossReg}>{`±${s.crossRegPct.toFixed(1)} %`}</td>
    : <td className={styles.moRegulated}>Regulated</td>
}

interface MultiOutputProps {
  vout: number
  capacitanceH: number
  secondaryTurns?: number
  results: SecondaryResult[]
}

export function MultiOutputSection({ vout, capacitanceH, secondaryTurns, results }: MultiOutputProps): React.ReactElement {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>Multi-Output Summary</div>
      <table className={styles.moTable}>
        <thead><tr><th>Output</th><th>Vout</th><th>Ns</th><th>Diode Vr</th><th>Cout</th><th>Cross-Reg</th></tr></thead>
        <tbody>
          <tr>
            <td className={styles.moLabel}>Out 1</td>
            <td>{vout.toFixed(1)} V</td>
            <td>{secondaryTurns ?? '—'}</td>
            <td>—</td>
            <td>{(capacitanceH * 1e6).toFixed(1)} µF</td>
            <td className={styles.moRegulated}>Regulated</td>
          </tr>
          {results.map((s) => (
            <tr key={s.label}>
              <td className={styles.moLabel}>{s.label}</td>
              <td>{s.vout_nominal.toFixed(1)} V</td>
              <td>{s.ns}</td>
              <td>{s.diode_vr_max.toFixed(0)} V</td>
              <td>{(s.capacitance * 1e6).toFixed(1)} µF</td>
              {regulationCell(s)}
            </tr>
          ))}
        </tbody>
      </table>
      <div className={styles.moWarning}>
        ⚠ Cross-regulation on unregulated outputs is typically ±5–10 %. Use post-regulators (LDO) for tight regulation.
      </div>
    </div>
  )
}
