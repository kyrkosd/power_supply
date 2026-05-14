// Feedback voltage divider result display with E96/E24 series label.
import React from 'react'
import { fmtResistor, type FeedbackResult } from '../../../engine/feedback'
import { Tooltip } from '../../Tooltip/Tooltip'
import { errorColor } from '../suggestionFormatters'
import styles from '../ComponentSuggestions.module.css'
import { feedbackDividerTip } from './tooltips'

export function FeedbackNetworkDisplay({ fb, vout }: { fb: FeedbackResult; vout: number }): React.ReactElement {
  const seriesLabel = fb.e96_values_used ? 'E96' : 'E24'
  const tip = feedbackDividerTip(fb, vout, seriesLabel)
  return (
    <div className={styles.fbBody}>
      <div className={styles.fbRow}>
        <span className={styles.fbLabel}>R_top <Tooltip content={tip} side="left"><span className={styles.infoIcon}>ⓘ</span></Tooltip></span>
        <span className={styles.fbValue}>{fmtResistor(fb.r_top)} <span className={styles.fbSeries}>{seriesLabel}</span></span>
      </div>
      <div className={styles.fbRow}><span className={styles.fbLabel}>R_bottom</span><span className={styles.fbValue}>{fmtResistor(fb.r_bottom)} <span className={styles.fbSeries}>{seriesLabel}</span></span></div>
      <div className={styles.fbRow}><span className={styles.fbLabel}>Actual Vout</span><span className={styles.fbValue}>{fb.actual_vout.toFixed(4)} V</span></div>
      <div className={styles.fbRow}><span className={styles.fbLabel}>Error</span><span className={styles.fbValue} style={{ color: errorColor(fb.vout_error_pct) }}>{fb.vout_error_pct >= 0 ? '+' : ''}{fb.vout_error_pct.toFixed(3)} %</span></div>
      <div className={styles.fbRow}><span className={styles.fbLabel}>Divider current</span><span className={styles.fbValue}>{(fb.divider_current * 1e6).toFixed(0)} µA</span></div>
      <div className={styles.fbRow}><span className={styles.fbLabel}>Power</span><span className={styles.fbValue}>{(fb.power_dissipated * 1000).toFixed(2)} mW</span></div>
    </div>
  )
}
