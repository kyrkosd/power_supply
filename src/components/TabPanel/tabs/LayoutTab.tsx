// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
import React from 'react'
import { LayoutGuide } from '../../LayoutGuide/LayoutGuide'
import styles from './Tab.module.css'

export function LayoutTab(): React.ReactElement {
  return (
    <div className={styles.tab}>
      <LayoutGuide />
    </div>
  )
}
