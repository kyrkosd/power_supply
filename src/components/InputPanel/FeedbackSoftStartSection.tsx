// Feedback network resistor divider and soft-start Css calculator sections for InputPanel.
import React from 'react'
import { useDesignStore } from '../../store/design-store'
import { Tooltip } from '../Tooltip/Tooltip'
import styles from './InputPanel.module.css'

/**
 * Collapsible section for the output-voltage feedback resistor divider.
 * Renders Vref selector, divider current, and E96/E24 series preference.
 * Always rendered regardless of topology.
 */
export function FeedbackSection(): React.ReactElement {
  const { feedbackOptions, setFeedbackOptions } = useDesignStore()

  return (
    <details className={styles.advancedSection}>
      <summary className={styles.advancedTitle}>
        Feedback Network
        <Tooltip
          content="Resistor divider that sets the output voltage. Vout = Vref × (1 + Rtop/Rbot). Values are snapped to the nearest E96 (or E24) standard value."
          side="right"
        >
          <span className={styles.infoIcon}>ⓘ</span>
        </Tooltip>
      </summary>
      <div className={styles.advancedBody}>

        <div className={styles.advancedRow}>
          <label className={styles.advancedLabel}>
            Reference voltage
            <Tooltip
              content="IC internal reference (Vref). Common values: 0.6 V (Renesas), 0.8 V (TI LMR, TPS6), 1.0 V, 1.25 V (LM317), 2.5 V (older ICs). Check your controller datasheet."
              side="right"
            >
              <span className={styles.infoIcon}>ⓘ</span>
            </Tooltip>
          </label>
          <select
            className={styles.advancedSelect}
            value={feedbackOptions.vref}
            onChange={(e) => setFeedbackOptions({ vref: Number(e.target.value) })}
          >
            <option value={0.6}>0.6 V</option>
            <option value={0.8}>0.8 V</option>
            <option value={1.0}>1.0 V</option>
            <option value={1.25}>1.25 V</option>
            <option value={2.5}>2.5 V</option>
          </select>
        </div>

        <div className={styles.advancedRow}>
          <label className={styles.advancedLabel}>
            Divider current
            <Tooltip
              content="DC bias current through the feedback divider. Higher current → better noise rejection but more quiescent loss. Typical: 50–200 µA."
              side="right"
            >
              <span className={styles.infoIcon}>ⓘ</span>
            </Tooltip>
          </label>
          <div className={styles.advancedInputGroup}>
            <input
              type="number"
              className={styles.advancedNumberInput}
              value={feedbackOptions.divider_current_ua}
              min={10}
              max={1000}
              step={10}
              onChange={(e) => setFeedbackOptions({ divider_current_ua: Math.max(10, Math.min(1000, Number(e.target.value))) })}
            />
            <span className={styles.advancedUnit}>µA</span>
          </div>
        </div>

        <div className={styles.advancedRow}>
          <label className={styles.advancedLabel}>
            Resistor series
            <Tooltip
              content="E96: 1% tolerance, 96 values/decade — tighter Vout error. E24: 5% tolerance, 24 values/decade — cheaper and more available."
              side="right"
            >
              <span className={styles.infoIcon}>ⓘ</span>
            </Tooltip>
          </label>
          <select
            className={styles.advancedSelect}
            value={feedbackOptions.prefer_e24 ? 'e24' : 'e96'}
            onChange={(e) => setFeedbackOptions({ prefer_e24: e.target.value === 'e24' })}
          >
            <option value="e96">E96 (1%)</option>
            <option value="e24">E24 (5%)</option>
          </select>
        </div>

      </div>
    </details>
  )
}

/**
 * Collapsible section for soft-start Css sizing and inrush estimation.
 * Renders auto/manual tss mode, tss time input (manual), and Iss charge current.
 * Always rendered regardless of topology.
 */
export function SoftStartSection(): React.ReactElement {
  const { softStartOptions, setSoftStartOptions } = useDesignStore()

  return (
    <details className={styles.advancedSection}>
      <summary className={styles.advancedTitle}>
        Soft-Start
        <Tooltip
          content="Controls how quickly the output voltage ramps up at power-on. Limits inrush current and prevents overshoot. Sets the Css capacitor value on ICs with a dedicated soft-start pin."
          side="right"
        >
          <span className={styles.infoIcon}>ⓘ</span>
        </Tooltip>
      </summary>
      <div className={styles.advancedBody}>

        <div className={styles.advancedRow}>
          <label className={styles.advancedLabel}>
            Auto calculate
            <Tooltip
              content="Derive tss from the output time constant: tss = Cout × Vout / Iout × 10. Disable to set a custom value."
              side="right"
            >
              <span className={styles.infoIcon}>ⓘ</span>
            </Tooltip>
          </label>
          <select
            className={styles.advancedSelect}
            value={softStartOptions.auto_tss ? 'auto' : 'manual'}
            onChange={(e) => setSoftStartOptions({ auto_tss: e.target.value === 'auto' })}
          >
            <option value="auto">Auto (recommended)</option>
            <option value="manual">Manual</option>
          </select>
        </div>

        {!softStartOptions.auto_tss && (
          <div className={styles.advancedRow}>
            <label className={styles.advancedLabel}>
              Soft-start time
              <Tooltip
                content="Time for Vout to ramp from 0 to its setpoint. Typical: 1–10 ms. Shorter → faster startup but higher inrush. Longer → safer but may trip upstream UVLO."
                side="right"
              >
                <span className={styles.infoIcon}>ⓘ</span>
              </Tooltip>
            </label>
            <div className={styles.advancedInputGroup}>
              <input
                type="number"
                className={styles.advancedNumberInput}
                value={(softStartOptions.tss_s * 1000).toFixed(1)}
                min={0.5}
                max={50}
                step={0.5}
                onChange={(e) => setSoftStartOptions({ tss_s: Number(e.target.value) / 1000 })}
              />
              <span className={styles.advancedUnit}>ms</span>
            </div>
          </div>
        )}

        <div className={styles.advancedRow}>
          <label className={styles.advancedLabel}>
            Charge current (Iss)
            <Tooltip
              content="IC internal soft-start pin charge current. Check your controller datasheet — typically 1–50 µA. Used to size the Css capacitor."
              side="right"
            >
              <span className={styles.infoIcon}>ⓘ</span>
            </Tooltip>
          </label>
          <div className={styles.advancedInputGroup}>
            <input
              type="number"
              className={styles.advancedNumberInput}
              value={softStartOptions.iss_ua}
              min={1}
              max={100}
              step={1}
              onChange={(e) => setSoftStartOptions({ iss_ua: Math.max(1, Math.min(100, Number(e.target.value))) })}
            />
            <span className={styles.advancedUnit}>µA</span>
          </div>
        </div>

      </div>
    </details>
  )
}
