// MOSFET (Q1) and optional synchronous-FET (Q2) sections wrapping MosfetCard.
import React from 'react'
import type { MosfetData } from '../../../engine/component-selector'
import { Tooltip } from '../../Tooltip/Tooltip'
import { MosfetCard } from '../MosfetCard'
import styles from '../ComponentSuggestions.module.css'
import { selectBadge } from './badges'
import { mosfetTip, syncFetTip } from './tooltips'

interface MosfetSectionProps {
  mosfet: MosfetData
  vdsReq: number
  peakCurrent: number
  isSelected: boolean
  onSelect: () => void
}

export function MosfetSection({ mosfet, vdsReq, peakCurrent, isSelected, onSelect }: MosfetSectionProps): React.ReactElement {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>
        MOSFET (Q1){' '}
        <Tooltip content={mosfetTip(vdsReq, peakCurrent)} side="right"><span className={styles.infoIcon}>ⓘ</span></Tooltip>
        {selectBadge(isSelected)}
      </div>
      <MosfetCard data={mosfet} isSelected={isSelected} onSelect={onSelect} />
    </div>
  )
}

export function SyncFETSection({ mosfet }: { mosfet: MosfetData }): React.ReactElement {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>
        Sync FET (Q2){' '}
        <Tooltip content={syncFetTip} side="right"><span className={styles.infoIcon}>ⓘ</span></Tooltip>
      </div>
      <MosfetCard data={mosfet} isSelected={false} onSelect={() => { /* sync FET selection not persisted yet */ }} />
    </div>
  )
}
