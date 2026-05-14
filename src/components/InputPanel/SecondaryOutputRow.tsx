// One row in the flyback multi-output windings block (Vout / Iout / Vf + remove button).
import React from 'react'
import type { SecondaryOutput } from '../../engine/types'
import styles from './InputPanel.module.css'

interface SecondaryRowProps {
  index: number
  output: SecondaryOutput
  onChange: (index: number, updated: SecondaryOutput) => void
  onRemove: (index: number) => void
}

export function SecondaryOutputRow({ index, output, onChange, onRemove }: SecondaryRowProps): React.ReactElement {
  const update = (patch: Partial<SecondaryOutput>) => onChange(index, { ...output, ...patch })
  return (
    <div className={styles.secondaryRow}>
      <span className={styles.secondaryLabel}>Out {index + 2}</span>

      <label className={styles.secondaryFieldLabel}>Vout</label>
      <input type="number" className={styles.secondaryInput} value={output.vout}
        min={0.1} max={500} step={0.1}
        onChange={(e) => update({ vout: Number(e.target.value) })} />
      <span className={styles.secondaryUnit}>V</span>

      <label className={styles.secondaryFieldLabel}>Iout</label>
      <input type="number" className={styles.secondaryInput} value={output.iout}
        min={0.01} max={50} step={0.1}
        onChange={(e) => update({ iout: Number(e.target.value) })} />
      <span className={styles.secondaryUnit}>A</span>

      <label className={styles.secondaryFieldLabel}>Vf</label>
      <input type="number" className={styles.secondaryInput} value={output.diode_vf}
        min={0} max={2} step={0.05}
        onChange={(e) => update({ diode_vf: Number(e.target.value) })} />
      <span className={styles.secondaryUnit}>V</span>

      <button className={styles.secondaryRemove} onClick={() => onRemove(index)} title="Remove this output">✕</button>
    </div>
  )
}
