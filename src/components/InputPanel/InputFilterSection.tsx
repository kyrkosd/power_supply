// Input EMI filter design section for InputPanel.
import React from 'react'
import { useDesignStore } from '../../store/design-store'
import { Tooltip } from '../Tooltip/Tooltip'
import styles from './InputPanel.module.css'

/**
 * Collapsible section that enables and configures the CM/DM input EMI filter designer.
 * When enabled, the filter schematic and impedance Bode plot appear in the Input Filter tab.
 * Checks Middlebrook negative-impedance stability margin automatically.
 */
export function InputFilterSection(): React.ReactElement {
  const { spec, updateSpec } = useDesignStore()
  const enabled = spec.inputFilterEnabled ?? false

  return (
    <details className={styles.advancedSection}>
      <summary className={styles.advancedTitle}>
        Input EMI Filter
        <Tooltip
          content="Designs a CM/DM input EMI filter to meet CISPR 32 Class B conducted emissions. Checks Middlebrook negative-impedance stability (filter must not destabilise the converter). Enable to see the filter schematic and impedance plot in the Input Filter tab."
          side="right"
        >
          <span className={styles.infoIcon}>ⓘ</span>
        </Tooltip>
      </summary>
      <div className={styles.advancedBody}>

        <div className={styles.advancedRow}>
          <label className={styles.advancedLabel}>Enable filter design</label>
          <select
            className={styles.advancedSelect}
            value={enabled ? 'on' : 'off'}
            onChange={(e) => updateSpec({ inputFilterEnabled: e.target.value === 'on' })}
          >
            <option value="off">Off</option>
            <option value="on">On</option>
          </select>
        </div>

        {enabled && (
          <>
            <div className={styles.advancedRow}>
              <label className={styles.advancedLabel}>
                Attenuation target (dB)
                <Tooltip
                  content="Override the auto-calculated required attenuation. 0 = auto (derived from EMI analysis). Typical: 30–60 dB. Higher values → larger/lower-resonance filter."
                  side="right"
                >
                  <span className={styles.infoIcon}>ⓘ</span>
                </Tooltip>
              </label>
              <div className={styles.advancedInputGroup}>
                <input
                  type="number"
                  className={styles.advancedNumberInput}
                  min={0}
                  max={80}
                  step={5}
                  value={spec.inputFilterAttenuationDb ?? 0}
                  onChange={(e) => updateSpec({ inputFilterAttenuationDb: Math.max(0, Math.min(80, Number(e.target.value))) })}
                />
                <span className={styles.advancedUnit}>dB</span>
              </div>
            </div>

            <div className={styles.advancedRow}>
              <label className={styles.advancedLabel}>
                CM choke (mH)
                <Tooltip
                  content="Common-mode choke inductance. 0 = auto-selected based on switching frequency. Range: 1–47 mH. Larger choke → better CM attenuation but bigger footprint."
                  side="right"
                >
                  <span className={styles.infoIcon}>ⓘ</span>
                </Tooltip>
              </label>
              <div className={styles.advancedInputGroup}>
                <input
                  type="number"
                  className={styles.advancedNumberInput}
                  min={0}
                  max={47}
                  step={1}
                  value={spec.inputFilterCmChokeMh ?? 0}
                  onChange={(e) => updateSpec({ inputFilterCmChokeMh: Math.max(0, Math.min(47, Number(e.target.value))) })}
                />
                <span className={styles.advancedUnit}>mH</span>
              </div>
            </div>
          </>
        )}

      </div>
    </details>
  )
}
