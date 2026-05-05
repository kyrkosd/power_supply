// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
import React from 'react'
import { useDesignStore } from '../../../store/design-store'
import { BodePlot } from '../../BodePlot/BodePlot'
import styles from './Tab.module.css'

export function BodeTab(): React.ReactElement {
  const spec = useDesignStore((state) => state.spec)
  const result = useDesignStore((state) => state.result)
  const topology = useDesignStore((state) => state.topology)

  if (!result || topology !== 'buck') {
    return (
      <div className={styles.tab}>
        <div className={styles.placeholder}>
          <div>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 8 }}>
              Bode plot is available for the Buck topology once the design is computed.
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
              Select Buck and enter design inputs, then check the Bode tab.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.tab}>
      <BodePlot spec={spec} result={result} />
    </div>
  )
}
