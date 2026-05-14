// Current-sense result display (resistor or Rds(on) method).
import React from 'react'
import type { CurrentSenseResult } from '../../../engine/current-sense'
import { fmtPower, snrColor } from '../suggestionFormatters'
import styles from '../ComponentSuggestions.module.css'

function ResistorRows({ cs }: { cs: CurrentSenseResult }): React.ReactElement {
  const kelvinColor = cs.kelvin_connection_required ? '#f59e0b' : '#4ade80'
  const kelvinText  = cs.kelvin_connection_required ? 'Required' : 'Not required'
  return (
    <>
      <div className={styles.fbRow}><span className={styles.fbLabel}>Rsense</span><span className={styles.fbValue}>{(cs.rsense * 1000).toFixed(2)} mΩ</span></div>
      <div className={styles.fbRow}><span className={styles.fbLabel}>Package</span><span className={styles.fbValue}>{cs.rsense_package}</span></div>
      <div className={styles.fbRow}><span className={styles.fbLabel}>Rsense power</span><span className={styles.fbValue}>{fmtPower(cs.rsense_power)}</span></div>
      <div className={styles.fbRow}><span className={styles.fbLabel}>Kelvin connections</span><span className={styles.fbValue} style={{ color: kelvinColor }}>{kelvinText}</span></div>
    </>
  )
}

function RdsonRow({ cs }: { cs: CurrentSenseResult }): React.ReactElement {
  return (
    <div className={styles.fbRow}>
      <span className={styles.fbLabel}>Temp accuracy</span>
      <span className={styles.fbValue} style={{ color: '#f59e0b' }}>±{cs.rdson_temp_error_pct.toFixed(0)} % (25–100 °C)</span>
    </div>
  )
}

export function CurrentSensingDisplay({ cs }: { cs: CurrentSenseResult }): React.ReactElement {
  const methodLabel = cs.method === 'resistor' ? 'Sense Resistor' : 'Rds(on)'
  return (
    <div className={styles.card} style={{ padding: '12px' }}>
      <div className={styles.fbRow}><span className={styles.fbLabel}>Method</span><span className={styles.fbValue}>{methodLabel}</span></div>
      {cs.method === 'resistor' && <ResistorRows cs={cs} />}
      {cs.method === 'rdson'    && <RdsonRow    cs={cs} />}
      <div className={styles.fbRow}><span className={styles.fbLabel}>Vsense peak</span><span className={styles.fbValue}>{(cs.vsense_peak * 1000).toFixed(1)} mV</span></div>
      <div className={styles.fbRow}><span className={styles.fbLabel}>Vsense valley</span><span className={styles.fbValue}>{(cs.vsense_valley * 1000).toFixed(1)} mV</span></div>
      <div className={styles.fbRow}><span className={styles.fbLabel}>SNR @ 10 % load</span><span className={styles.fbValue} style={{ color: snrColor(cs.snr_at_light_load) }}>{cs.snr_at_light_load.toFixed(1)} dB</span></div>
      <div className={styles.fbRow}><span className={styles.fbLabel}>Slope comp ramp</span><span className={styles.fbValue}>{(cs.slope_comp_ramp / 1e6).toFixed(2)} V/µs</span></div>
      {cs.warnings.map((w, i) => <div key={i} className={styles.ssWarn}>{w}</div>)}
    </div>
  )
}
