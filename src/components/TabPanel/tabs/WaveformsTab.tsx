// Waveforms tab: synchronized inductor/switch D3 charts for the buck topology.
import React from 'react'
import { useDesignStore } from '../../../store/design-store'
import { WaveformChart } from '../../WaveformChart/WaveformChart'
import styles from './Tab.module.css'

const UNAVAIL_STYLE: React.CSSProperties = { color: 'var(--text-secondary)', marginBottom: 10 }
const HINT_STYLE:    React.CSSProperties = { color: 'var(--text-muted)' }

/** Renders synchronized D3 waveform charts (buck only) or a topology-unavailable placeholder. */
export function WaveformsTab(): React.ReactElement {
  const { topology, waveforms, spec } = useDesignStore()
  return (
    <div className={styles.tab}>
      {topology === 'buck' && waveforms ? (
        <WaveformChart waveforms={waveforms} spec={spec} />
      ) : (
        <div className={styles.placeholder}>
          <div>
            <div style={UNAVAIL_STYLE}>Waveform rendering is available for the buck topology.</div>
            <div style={HINT_STYLE}>Select a buck design and adjust inputs to see synchronized D3 charts.</div>
          </div>
        </div>
      )}
    </div>
  )
}
