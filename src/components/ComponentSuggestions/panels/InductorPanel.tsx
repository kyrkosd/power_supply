// Inductor card with specs, saturation margin badge, and select toggle.
import React from 'react'
import type { InductorData } from '../../../engine/component-selector'
import { checkSaturation } from '../../../engine/inductor-saturation'
import { Tooltip } from '../../Tooltip/Tooltip'
import styles from '../ComponentSuggestions.module.css'

interface InductorCardProps {
  inductor: InductorData
  peakCurrent: number
  iout: number
  isSelected: boolean
  peakCurrentTooltip: React.ReactNode
  onSelect: () => void
}

function pickColor(isSat: boolean, marginPct: number | null): string {
  if (isSat || (marginPct !== null && marginPct < 10)) return '#ef4444'
  if (marginPct !== null && marginPct < 30) return '#f59e0b'
  return '#4ade80'
}

function buildLabel(isSat: boolean, marginPct: number | null, bPeak: number, bSat: number): string {
  if (isSat) return 'SATURATED'
  if (marginPct !== null) return `${marginPct.toFixed(0)} % headroom`
  return `B ≈ ${(bPeak / bSat * 100).toFixed(0)} % of Bsat`
}

function satLabel(inductor: InductorData, peakCurrent: number, iout: number): { label: string; color: string } {
  const sat = checkSaturation(peakCurrent, iout, inductor)
  return {
    label: buildLabel(sat.is_saturated, sat.margin_pct, sat.estimated_B_peak, sat.B_sat_material),
    color: pickColor(sat.is_saturated, sat.margin_pct),
  }
}

export function InductorCard({ inductor, peakCurrent, iout, isSelected, peakCurrentTooltip, onSelect }: InductorCardProps): React.ReactElement {
  const { label, color } = satLabel(inductor, peakCurrent, iout)
  return (
    <div className={styles.card}>
      <div className={styles.cardHeader}>
        <span className={styles.rank}>#1</span>
        <span className={styles.partNumber}>{inductor.part_number}</span>
      </div>
      <div className={styles.manufacturer}>{inductor.manufacturer}</div>
      <div className={styles.specs}>
        <span className={styles.spec}><strong>{inductor.inductance_uh}</strong> µH</span>
        <span className={styles.spec}>DCR <strong>{inductor.dcr_mohm}</strong> mΩ</span>
        <span className={styles.spec}>
          Isat <Tooltip content={peakCurrentTooltip} side="top"><strong>{inductor.isat_a}</strong></Tooltip> A
        </span>
        <span className={styles.spec}>Irms <strong>{inductor.irms_a}</strong> A</span>
      </div>
      <div className={styles.satRow}>
        <span className={styles.satLabel}>Sat. margin</span>
        <span className={styles.satValue} style={{ color }}>{label}</span>
      </div>
      <button className={styles.selectButton} onClick={onSelect}>
        {isSelected ? 'Deselect' : 'Select'}
      </button>
    </div>
  )
}
