// Reusable MOSFET card displaying key electrical specs with a select toggle.
import React from 'react'
import type { MosfetData } from '../../engine/component-selector'
import styles from './ComponentSuggestions.module.css'

interface MosfetCardProps {
  /** MOSFET data from the local component database. */
  data: MosfetData
  /** Whether this part is currently selected in the design store. */
  isSelected: boolean
  /** Called when the user clicks the Select / Deselect button. */
  onSelect: () => void
}

/** Compact card displaying MOSFET ratings (Vds, Rds, Qg, Id) with a select toggle. */
export function MosfetCard({ data, isSelected, onSelect }: MosfetCardProps): React.ReactElement {
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.rank}>#1</span>
        <span className={styles.partNumber}>{data.part_number}</span>
      </div>
      <div className={styles.manufacturer}>{data.manufacturer}</div>
      <div className={styles.specs}>
        <span className={styles.spec}>Vds <strong>{data.vds_v}</strong> V</span>
        <span className={styles.spec}>Rds <strong>{data.rds_on_mohm}</strong> mΩ</span>
        <span className={styles.spec}>Qg <strong>{data.qg_nc}</strong> nC</span>
        <span className={styles.spec}>Id <strong>{data.id_max_a}</strong> A</span>
        <span className={styles.spec}>{data.package}</span>
      </div>
      <button className={styles.selectButton} onClick={onSelect}>
        {isSelected ? 'Deselect' : 'Select'}
      </button>
    </div>
  )
}
