import React from 'react'
import { useDesignStore } from '../../../store/design-store'
import { WaveformChart } from '../../WaveformChart/WaveformChart'
import styles from './Tab.module.css'

export function WaveformsTab(): React.ReactElement {
  const { topology, waveforms, spec } = useDesignStore()

  return (
    <div className={styles.tab}>
      {topology === 'buck' && waveforms ? (
        <WaveformChart waveforms={waveforms} spec={spec} />
      ) : (
        <div className={styles.placeholder}>
          <div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: 10 }}>
              Waveform rendering is available for the buck topology.
            </div>
            <div style={{ color: 'var(--text-muted)' }}>
              Select a buck design and adjust inputs to see synchronized D3 charts.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
