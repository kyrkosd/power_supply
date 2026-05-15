import React from 'react'
import type { SweepParam } from '../../store/design-store'
import type { ParamDef } from './sweepDefs'
import { PARAM_DEFS } from './sweepDefs'
import styles from './SweepView.module.css'

interface Props {
  sweepParam:   SweepParam
  minDisp:      string
  maxDisp:      string
  steps:        number
  pd:           ParamDef
  disabled:     boolean
  canRun:       boolean
  hasResult:    boolean
  onParamChange: (p: SweepParam) => void
  onMinChange:   (v: string) => void
  onMaxChange:   (v: string) => void
  onStepsChange: (v: number) => void
  onRun:         () => void
  onExport:      () => void
}

export function SweepConfigRow({ sweepParam, minDisp, maxDisp, steps, pd, disabled, canRun, hasResult, onParamChange, onMinChange, onMaxChange, onStepsChange, onRun, onExport }: Props): React.ReactElement {
  return (
    <div className={styles.configRow}>
      <div className={styles.configGroup}>
        <span className={styles.configLabel}>Sweep</span>
        <select className={styles.configSelect} value={sweepParam} disabled={disabled}
          onChange={(e) => onParamChange(e.target.value as SweepParam)}>
          {PARAM_DEFS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        </select>
      </div>
      <div className={styles.configGroup}>
        <span className={styles.configLabel}>Min</span>
        <input className={styles.configInput} value={minDisp} disabled={disabled} onChange={(e) => onMinChange(e.target.value)} />
        {pd.unit && <span className={styles.configUnit}>{pd.unit}</span>}
      </div>
      <div className={styles.configGroup}>
        <span className={styles.configLabel}>Max</span>
        <input className={styles.configInput} value={maxDisp} disabled={disabled} onChange={(e) => onMaxChange(e.target.value)} />
        {pd.unit && <span className={styles.configUnit}>{pd.unit}</span>}
      </div>
      <div className={styles.configGroup}>
        <span className={styles.configLabel}>Steps</span>
        <input className={`${styles.configInput} ${styles.configInputSmall}`} type="number"
          min={2} max={100} value={steps} disabled={disabled}
          onChange={(e) => onStepsChange(Math.max(2, Math.min(100, parseInt(e.target.value) || 20)))} />
      </div>
      <div className={styles.spacer} />
      <button className={styles.runBtn} disabled={!canRun} onClick={onRun}>
        {disabled ? '⏳ Computing…' : '▶ Run Sweep'}
      </button>
      <button className={styles.exportBtn} onClick={onExport} disabled={!hasResult}>↓ CSV</button>
    </div>
  )
}
