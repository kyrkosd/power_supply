import React from 'react'
import { useDesignStore } from '../../store/design-store'
import { suggestInductors, suggestCapacitors } from '../../engine/component-selector'
import styles from './ComponentSuggestions.module.css'

export function ComponentSuggestions() {
  const { result, spec } = useDesignStore()

  if (!result) {
    return (
      <div className={styles.panel}>
        <div className={styles.header}>Components</div>
        <div className={styles.empty}>Run a simulation first.</div>
      </div>
    )
  }

  const inductor  = suggestInductors(result.inductance * 1e6, result.peakCurrent)[0]
  const capacitor = suggestCapacitors(result.capacitance * 1e6, spec.vout * 1.5)[0]

  return (
    <div className={styles.panel}>
      <div className={styles.header}>Components</div>

      {inductor && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Inductor</div>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.rank}>#1</span>
              <span className={styles.partNumber}>{inductor.part_number}</span>
            </div>
            <div className={styles.manufacturer}>{inductor.manufacturer}</div>
            <div className={styles.specs}>
              <span className={styles.spec}><strong>{inductor.inductance_uh}</strong> µH</span>
              <span className={styles.spec}>DCR <strong>{inductor.dcr_mohm}</strong> mΩ</span>
              <span className={styles.spec}>Isat <strong>{inductor.isat_a}</strong> A</span>
              <span className={styles.spec}>Irms <strong>{inductor.irms_a}</strong> A</span>
            </div>
            <button className={styles.selectButton}>Select</button>
          </div>
        </div>
      )}

      {capacitor && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Output Cap</div>
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.rank}>#1</span>
              <span className={styles.partNumber}>{capacitor.part_number}</span>
            </div>
            <div className={styles.manufacturer}>{capacitor.manufacturer}</div>
            <div className={styles.specs}>
              <span className={styles.spec}><strong>{capacitor.capacitance_uf}</strong> µF</span>
              <span className={styles.spec}><strong>{capacitor.voltage_v}</strong> V</span>
              <span className={styles.spec}>ESR <strong>{capacitor.esr_mohm}</strong> mΩ</span>
              <span className={styles.spec}>{capacitor.type}</span>
            </div>
            <button className={styles.selectButton}>Select</button>
          </div>
        </div>
      )}
    </div>
  )
}
