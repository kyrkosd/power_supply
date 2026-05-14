// Inductor (L1) section wrapping the InductorCard with title + tooltip.
import React from 'react'
import type { InductorData } from '../../../engine/component-selector'
import { Tooltip } from '../../Tooltip/Tooltip'
import styles from '../ComponentSuggestions.module.css'
import { selectBadge } from './badges'
import { InductorCard } from './InductorPanel'
import { inductanceTip, peakCurrentTip } from './tooltips'

interface InductorSectionProps {
  inductor: InductorData
  inductanceH: number
  peakCurrent: number
  iout: number
  isSelected: boolean
  onSelect: () => void
}

export function InductorSection({ inductor, inductanceH, peakCurrent, iout, isSelected, onSelect }: InductorSectionProps): React.ReactElement {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>
        Inductor (L1){' '}
        <Tooltip content={inductanceTip(inductanceH)} side="right"><span className={styles.infoIcon}>ⓘ</span></Tooltip>
        {selectBadge(isSelected)}
      </div>
      <InductorCard
        inductor={inductor}
        peakCurrent={peakCurrent}
        iout={iout}
        isSelected={isSelected}
        peakCurrentTooltip={peakCurrentTip(peakCurrent)}
        onSelect={onSelect}
      />
    </div>
  )
}
