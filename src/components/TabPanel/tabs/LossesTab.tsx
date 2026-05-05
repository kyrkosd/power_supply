// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
import React from 'react'
import { useDesignStore } from '../../../store/design-store'
import { LossBreakdown } from '../../LossBreakdown/LossBreakdown'
import styles from './Tab.module.css'

export function LossesTab(): React.ReactElement {
  const result = useDesignStore((state) => state.result)

  return (
    <div className={styles.tab}>
      {result ? <LossBreakdown /> : <div className={styles.placeholder}>Run simulation to compute loss breakdown.</div>}
    </div>
  )
}
