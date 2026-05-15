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
