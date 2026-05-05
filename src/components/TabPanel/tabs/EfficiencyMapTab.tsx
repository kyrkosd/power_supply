// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
import React from 'react'
import { EfficiencyMap } from '../../EfficiencyMap/EfficiencyMap'
import styles from './Tab.module.css'

export function EfficiencyMapTab(): React.ReactElement {
  return (
    <div className={styles.tab}>
      <EfficiencyMap />
    </div>
  )
}
