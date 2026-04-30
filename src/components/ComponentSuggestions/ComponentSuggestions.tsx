import React from 'react'
import { useDesignStore } from '../../store/design-store'
import { suggestInductors, suggestCapacitors, suggestMosfets, InductorData, CapacitorData, MosfetData } from '../../engine/component-selector'
import styles from './ComponentSuggestions.module.css'

export function ComponentSuggestions() {
  const { result, spec, updateSpec } = useDesignStore()

  if (!result) return null

  const suggestedInductors = suggestInductors(result.inductance * 1e6, result.peakCurrent)
  const suggestedCapacitors = suggestCapacitors(result.capacitance * 1e6, spec.vout * 1.5)
  const suggestedMosfets = suggestMosfets(spec.vinMax * 1.5)

  const handleInductorSelect = (inductor: InductorData) => {
    // Update spec with selected inductor parameters
    updateSpec({
      // Could add inductor-specific fields to spec if needed
    })
  }

  const handleCapacitorSelect = (capacitor: CapacitorData) => {
    // Update spec with selected capacitor parameters
    updateSpec({
      // Could add capacitor-specific fields to spec if needed
    })
  }

  const handleMosfetSelect = (mosfet: MosfetData) => {
    // Update spec with selected MOSFET parameters
    updateSpec({
      // Could add MOSFET-specific fields to spec if needed
    })
  }

  return (
    <div className={styles.container}>
      <h3>Component Suggestions</h3>

      <div className={styles.section}>
        <h4>Inductors (L = {result.inductance * 1e6} µH)</h4>
        <div className={styles.componentList}>
          {suggestedInductors.map((inductor, index) => (
            <div key={inductor.part_number} className={styles.componentCard}>
              <div className={styles.componentHeader}>
                <span className={styles.rank}>#{index + 1}</span>
                <span className={styles.partNumber}>{inductor.part_number}</span>
              </div>
              <div className={styles.specs}>
                <div>{inductor.manufacturer}</div>
                <div>{inductor.inductance_uh} µH</div>
                <div>DCR: {inductor.dcr_mohm} mΩ</div>
                <div>Isat: {inductor.isat_a} A</div>
                <div>Irms: {inductor.irms_a} A</div>
              </div>
              <button
                className={styles.selectButton}
                onClick={() => handleInductorSelect(inductor)}
              >
                Select
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <h4>Output Capacitors (C = {result.capacitance * 1e6} µF)</h4>
        <div className={styles.componentList}>
          {suggestedCapacitors.map((capacitor, index) => (
            <div key={capacitor.part_number} className={styles.componentCard}>
              <div className={styles.componentHeader}>
                <span className={styles.rank}>#{index + 1}</span>
                <span className={styles.partNumber}>{capacitor.part_number}</span>
              </div>
              <div className={styles.specs}>
                <div>{capacitor.manufacturer}</div>
                <div>{capacitor.capacitance_uf} µF @ {capacitor.voltage_v} V</div>
                <div>ESR: {capacitor.esr_mohm} mΩ</div>
                <div>Ripple: {capacitor.ripple_current_a} A</div>
                <div>Type: {capacitor.type}</div>
              </div>
              <button
                className={styles.selectButton}
                onClick={() => handleCapacitorSelect(capacitor)}
              >
                Select
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.section}>
        <h4>MOSFETs (Vds max = {spec.vinMax * 1.5} V)</h4>
        <div className={styles.componentList}>
          {suggestedMosfets.map((mosfet, index) => (
            <div key={mosfet.part_number} className={styles.componentCard}>
              <div className={styles.componentHeader}>
                <span className={styles.rank}>#{index + 1}</span>
                <span className={styles.partNumber}>{mosfet.part_number}</span>
              </div>
              <div className={styles.specs}>
                <div>{mosfet.manufacturer}</div>
                <div>Vds: {mosfet.vds_v} V</div>
                <div>Rds(on): {mosfet.rds_on_mohm} mΩ</div>
                <div>Qg: {mosfet.qg_nc} nC</div>
                <div>Id max: {mosfet.id_max_a} A</div>
              </div>
              <button
                className={styles.selectButton}
                onClick={() => handleMosfetSelect(mosfet)}
              >
                Select
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}