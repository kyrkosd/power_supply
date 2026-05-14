import React from 'react'
import type { SweepResult } from '../../store/design-store'
import type { DesignSpec } from '../../engine/types'
import type { ParamDef } from './sweepDefs'
import { METRICS } from './sweepDefs'
import styles from './SweepView.module.css'

function nd(v: number | null | undefined, dec: number): React.ReactElement {
  return v != null ? <td>{v.toFixed(dec)}</td> : <td><span className={styles.nullVal}>—</span></td>
}

interface Props {
  result:        SweepResult
  resultPd:      ParamDef
  spec:          DesignSpec
  currentRowIdx: number
  hoverIdx:      number | null
  onHover:       (i: number | null) => void
}

export function SweepTable({ result, resultPd, spec, currentRowIdx, hoverIdx, onHover }: Props): React.ReactElement {
  const effM = METRICS.find((m) => m.key === 'efficiency')!
  const tjM  = METRICS.find((m) => m.key === 'mosfetTj')!
  const ripM = METRICS.find((m) => m.key === 'outputRipple')!

  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>{resultPd.label}{resultPd.unit ? ` (${resultPd.unit})` : ''}</th>
            <th>L (µH)</th><th>C (µF)</th><th>D (%)</th><th>η (%)</th>
            <th>P_loss (W)</th><th>PM (°)</th><th>Tj (°C)</th><th>ΔV (mV)</th><th>I_crit (A)</th>
          </tr>
        </thead>
        <tbody>
          {result.points.map((pt, i) => {
            const r   = pt.result
            const eff = effM.get(pt, result.sweepParam, spec)
            const tj  = tjM.get(pt, result.sweepParam, spec)
            const rip = ripM.get(pt, result.sweepParam, spec)
            const rowClass = (i === currentRowIdx || i === hoverIdx) ? styles.currentRow : ''
            return (
              <tr key={i} className={rowClass}
                onMouseEnter={() => onHover(i)} onMouseLeave={() => onHover(null)}>
                <td>{(pt.paramValue / resultPd.displayScale).toFixed(resultPd.decimals)}</td>
                {r ? <>{nd(r.inductance * 1e6, 3)}{nd(r.capacitance * 1e6, 3)}{nd(r.dutyCycle * 100, 2)}{nd(eff, 2)}{nd(r.losses?.total, 4)}{nd(pt.phaseMargin, 1)}{nd(tj, 1)}{nd(rip, 3)}{nd(r.ccm_dcm_boundary, 3)}</>
                  : Array.from({ length: 9 }, (_, ci) => <td key={ci}><span className={styles.nullVal}>—</span></td>)}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
