// Output capacitor card with optional DC-bias derating and Arrhenius lifetime estimate.
import React from 'react'
import type { CapacitorData } from '../../../engine/component-selector'
import type { CapLifetimeResult } from '../../../engine/cap-lifetime'
import { Tooltip } from '../../Tooltip/Tooltip'
import styles from '../ComponentSuggestions.module.css'
import { selectBadge } from './badges'
import { capacitanceTip } from './tooltips'
import { CapLifetimeRow } from './CapLifetimePanel'

interface CapDerating { effective_uF: number; ratio: number }

interface OutputCapProps {
  capacitor: CapacitorData
  capacitanceH: number
  capDerating: CapDerating | null
  capLife: CapLifetimeResult | null
  ambientTemp: number
  isSelected: boolean
  onSelect: () => void
}

function deratingColor(ratio: number): string {
  return ratio < 0.5 ? '#f87171' : '#fbbf24'
}

function DeratingRow({ d }: { d: CapDerating }): React.ReactElement | null {
  if (d.ratio >= 0.99) return null
  return (
    <div className={styles.deratingRow}>
      <span className={styles.deratingLabel}>DC bias derated</span>
      <span className={styles.deratingValue} style={{ color: deratingColor(d.ratio) }}>
        {d.effective_uF.toFixed(2)} µF ({(d.ratio * 100).toFixed(0)} %)
      </span>
    </div>
  )
}

function LifetimeBlock({ life, ambientTemp, capType }: { life: CapLifetimeResult | null; ambientTemp: number; capType: string }): React.ReactElement | null {
  if (life !== null) return <CapLifetimeRow lifetime={life} ambientTemp={ambientTemp} />
  if (capType !== 'electrolytic') {
    return (
      <div className={styles.lifetimeRow}>
        <span className={styles.lifetimeLabel}>Lifetime</span>
        <span className={styles.lifetimeNa}>N/A — ceramic caps have no wear-out</span>
      </div>
    )
  }
  return null
}

export function OutputCapSection({ capacitor, capacitanceH, capDerating, capLife, ambientTemp, isSelected, onSelect }: OutputCapProps): React.ReactElement {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>
        Output Cap (Cout){' '}
        <Tooltip content={capacitanceTip(capacitanceH)} side="right"><span className={styles.infoIcon}>ⓘ</span></Tooltip>
        {selectBadge(isSelected)}
      </div>
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
        {capDerating && <DeratingRow d={capDerating} />}
        <LifetimeBlock life={capLife} ambientTemp={ambientTemp} capType={capacitor.type} />
        <button className={styles.selectButton} onClick={onSelect}>
          {isSelected ? 'Deselect' : 'Select'}
        </button>
      </div>
    </div>
  )
}
