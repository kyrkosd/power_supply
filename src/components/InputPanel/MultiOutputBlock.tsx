// Multi-output windings block — flyback only. Up to 3 additional secondaries.
import React from 'react'
import type { SecondaryOutput } from '../../engine/types'
import { SecondaryOutputRow } from './SecondaryOutputRow'
import styles from './InputPanel.module.css'

interface MultiOutputBlockProps {
  secondaries: SecondaryOutput[]
  onAdd:    () => void
  onToggle: () => void
  onChange: (index: number, updated: SecondaryOutput) => void
  onRemove: (index: number) => void
}

const MAX_OUTPUTS = 3

export function MultiOutputBlock({ secondaries, onAdd, onToggle, onChange, onRemove }: MultiOutputBlockProps): React.ReactElement {
  const enabled = secondaries.length > 0
  const canAdd  = enabled && secondaries.length < MAX_OUTPUTS

  return (
    <div className={styles.multiOutputSection}>
      <div className={styles.multiOutputHeader}>
        <span className={styles.multiOutputTitle}>Multi-Output Windings</span>
        <div className={styles.multiOutputHeaderActions}>
          {canAdd && (
            <button className={styles.multiOutputAdd} onClick={onAdd} title="Add secondary winding (max 4 total)">+ Add Output</button>
          )}
          <button className={styles.multiOutputToggle} onClick={onToggle}>
            {enabled ? 'Disable' : 'Enable'}
          </button>
        </div>
      </div>
      {enabled && (
        <>
          {secondaries.map((s, i) => (
            <SecondaryOutputRow key={i} index={i} output={s} onChange={onChange} onRemove={onRemove} />
          ))}
          {canAdd && (
            <button className={styles.multiOutputAdd} onClick={onAdd} title="Add another secondary winding">+ Add Output</button>
          )}
          <div className={styles.crossRegWarning}>
            ⚠ Cross-regulation on unregulated outputs is typically ±5–10 %. Use post-regulators (LDO) for tight regulation.
          </div>
        </>
      )}
    </div>
  )
}
