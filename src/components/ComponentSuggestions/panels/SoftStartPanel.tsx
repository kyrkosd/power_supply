// Soft-start parameter display with Css tooltip and link to the transient tab.
import React from 'react'
import type { SoftStartResult } from '../../../engine/soft-start'
import { Tooltip } from '../../Tooltip/Tooltip'
import { fmtMs, fmtCap2 } from '../suggestionFormatters'
import styles from '../ComponentSuggestions.module.css'
import { YesNo } from './badges'
import { softStartCssTip } from './tooltips'

interface SoftStartProps { ss: SoftStartResult; onTransientClick: () => void }

function inrushColor(peak: number): string { return peak > 50 ? '#ef4444' : 'inherit' }

export function SoftStartDisplay({ ss, onTransientClick }: SoftStartProps): React.ReactElement {
  const cssTip = softStartCssTip(ss)
  return (
    <div className={styles.fbBody}>
      <div className={styles.fbRow}><span className={styles.fbLabel}>tss (used)</span><span className={styles.fbValue}>{fmtMs(ss.tss_used)}</span></div>
      <div className={styles.fbRow}><span className={styles.fbLabel}>tss (recommended)</span><span className={styles.fbValue}>{fmtMs(ss.recommended_tss)}</span></div>
      <div className={styles.fbRow}>
        <span className={styles.fbLabel}>Css <Tooltip content={cssTip} side="left"><span className={styles.infoIcon}>ⓘ</span></Tooltip></span>
        <span className={styles.fbValue}>{fmtCap2(ss.css)}</span>
      </div>
      <div className={styles.fbRow}><span className={styles.fbLabel}>Inrush (no SS)</span><span className={styles.fbValue} style={{ color: inrushColor(ss.peak_inrush_a) }}>{ss.peak_inrush_a.toFixed(0)} A</span></div>
      <div className={styles.fbRow}><span className={styles.fbLabel}>Inrush (with SS)</span><span className={styles.fbValue}>{ss.peak_inrush_with_ss.toFixed(2)} A</span></div>
      <div className={styles.fbRow}><span className={styles.fbLabel}>Monotonic startup</span><YesNo ok={ss.output_monotonic} label={ss.output_monotonic ? 'Yes' : 'No'} /></div>
      <div className={styles.fbRow}><span className={styles.fbLabel}>Pre-bias safe</span><YesNo ok={ss.pre_bias_safe} label={ss.pre_bias_safe ? 'Yes' : 'No'} /></div>
      {ss.warnings.map((w, i) => <div key={i} className={styles.ssWarn}>{w}</div>)}
      <button className={styles.ssTransientLink} onClick={onTransientClick}>→ Transient tab for startup simulation</button>
    </div>
  )
}
