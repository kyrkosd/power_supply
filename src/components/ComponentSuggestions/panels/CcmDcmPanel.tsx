// CCM/DCM operating-mode badge with boundary current display.
import React from 'react'
import { Tooltip } from '../../Tooltip/Tooltip'
import { getModeColor } from '../suggestionFormatters'
import styles from '../ComponentSuggestions.module.css'
import { ccmBoundaryTip } from './tooltips'

interface CcmDcmProps { boundary: number; mode?: string }

const rowStyle: React.CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
const labelStyle: React.CSSProperties = { color: 'var(--text-secondary)' }
const footerStyle: React.CSSProperties = { fontSize: '11px', color: 'var(--text-secondary)', marginTop: '8px' }

export function CcmDcmSection({ boundary, mode }: CcmDcmProps): React.ReactElement {
  return (
    <div className={styles.section}>
      <div className={styles.sectionTitle}>
        CCM/DCM Operating Mode{' '}
        <Tooltip content={ccmBoundaryTip(boundary, mode)} side="right"><span className={styles.infoIcon}>ⓘ</span></Tooltip>
      </div>
      <div className={styles.card} style={{ padding: '12px' }}>
        <div style={{ ...rowStyle, marginBottom: '8px' }}>
          <span style={labelStyle}>Operating Mode:</span>
          <span style={{ color: getModeColor(mode), fontWeight: 'bold', fontSize: '14px' }}>{mode ?? 'Unknown'}</span>
        </div>
        <div style={rowStyle}>
          <span style={labelStyle}>CCM Boundary:</span>
          <span style={{ fontWeight: 'bold' }}>{boundary.toFixed(3)} A</span>
        </div>
        <div style={footerStyle}>Load current below {boundary.toFixed(3)} A enters DCM</div>
      </div>
    </div>
  )
}
