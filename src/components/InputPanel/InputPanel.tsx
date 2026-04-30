import React from 'react'
import { useDesignStore, type DesignSpec } from '../../store/design-store'
import styles from './InputPanel.module.css'

interface FieldDef {
  key: keyof DesignSpec
  label: string
  unit: string
  min: number
  max: number
  step: number
  decimals: number
  scale?: number
  log?: boolean
}

const SPEC_FIELDS: FieldDef[] = [
  { key: 'vinMin', label: 'Vin min', unit: 'V', min: 1, max: 60, step: 0.1, decimals: 1 },
  { key: 'vinMax', label: 'Vin max', unit: 'V', min: 1, max: 60, step: 0.1, decimals: 1 },
  { key: 'vout', label: 'Vout', unit: 'V', min: 0.5, max: 50, step: 0.1, decimals: 2 },
  { key: 'iout', label: 'Iout', unit: 'A', min: 0.1, max: 30, step: 0.1, decimals: 2 },
]

const OPERATING_FIELDS: FieldDef[] = [
  { key: 'fsw', label: 'Switching freq', unit: 'kHz', min: 10_000, max: 2_000_000, step: 1, decimals: 0, scale: 1000, log: true },
  { key: 'rippleRatio', label: 'Ripple ratio', unit: '', min: 0.1, max: 0.5, step: 0.01, decimals: 2 },
  { key: 'ambientTemp', label: 'Ambient temp', unit: '°C', min: 25, max: 85, step: 1, decimals: 0 },
]

const TARGET_FIELDS: FieldDef[] = [
  { key: 'voutRippleMax', label: 'Vout ripple max', unit: 'mV', min: 0.001, max: 0.5, step: 0.001, decimals: 0, scale: 1000 },
  { key: 'efficiency', label: 'Efficiency target', unit: '%', min: 0.8, max: 0.99, step: 0.01, decimals: 0, scale: 0.01 },
]

function toDisplay(field: FieldDef, raw: number): number {
  return field.scale ? raw / field.scale : raw
}

function toRaw(field: FieldDef, display: number): number {
  return field.scale ? display * field.scale : display
}

function sliderValue(field: FieldDef, raw: number): number {
  return field.log ? Math.log10(raw) : toDisplay(field, raw)
}

function sliderMin(field: FieldDef): number {
  return field.log ? Math.log10(field.min) : field.scale ? field.min / field.scale : field.min
}

function sliderMax(field: FieldDef): number {
  return field.log ? Math.log10(field.max) : field.scale ? field.max / field.scale : field.max
}

function sliderStep(field: FieldDef): number {
  return field.log ? 0.01 : field.step
}

function formatDisplay(value: number, decimals: number): string {
  return Number.isFinite(value) ? value.toFixed(decimals) : '—'
}

export function InputPanel(): React.ReactElement {
  const { spec, result, updateSpec } = useDesignStore()

  const sections = [
    { title: 'Specifications', fields: SPEC_FIELDS },
    { title: 'Operating', fields: OPERATING_FIELDS },
    { title: 'Targets', fields: TARGET_FIELDS },
  ]

  const onFieldChange = (field: FieldDef, value: number) => {
    const normalized = field.log ? Math.pow(10, value) : value
    const raw = field.log ? normalized : toRaw(field, normalized)
    updateSpec({ [field.key]: raw } as Partial<DesignSpec>)
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>Design Inputs</div>

      <div className={styles.sections}>
        {sections.map((section) => (
          <details key={section.title} open className={styles.section}>
            <summary className={styles.sectionTitle}>{section.title}</summary>
            <div className={styles.sectionBody}>
              {section.fields.map((field) => {
                const rawValue = spec[field.key] as number
                const displayValue = toDisplay(field, rawValue)
                const minDisplay = toDisplay(field, field.min)
                const maxDisplay = toDisplay(field, field.max)
                const slider = sliderValue(field, rawValue)

                return (
                  <div key={field.key} className={styles.fieldRow}>
                    <div className={styles.rowLabel}>
                      <span>{field.label}</span>
                      <span className={styles.rowUnit}>{field.unit}</span>
                    </div>

                    <input
                      type="range"
                      className={styles.slider}
                      min={sliderMin(field)}
                      max={sliderMax(field)}
                      step={sliderStep(field)}
                      value={slider}
                      onChange={(event) => onFieldChange(field, Number(event.target.value))}
                    />

                    <div className={styles.rowControls}>
                      <input
                        type="number"
                        className={styles.numberInput}
                        value={displayValue}
                        step={field.step}
                        min={minDisplay}
                        max={maxDisplay}
                        onChange={(event) => onFieldChange(field, Number(event.target.value))}
                      />
                      <span className={styles.unitLabel}>{field.unit}</span>
                    </div>

                    <div className={styles.rangeHints}>
                      <span>{formatDisplay(minDisplay, field.decimals)}</span>
                      <span>{formatDisplay(maxDisplay, field.decimals)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </details>
        ))}
      </div>

      <div className={styles.summaryPanel}>
        <div className={styles.summaryRow}>
          <span>Duty cycle</span>
          <strong title="Buck: D = Vout / Vin_max&#10;Boost: D = 1 − Vin_min/Vout&#10;Buck-boost: D = Vout/(Vin_min+Vout)">
            {result ? `${(result.dutyCycle * 100).toFixed(1)} %` : '—'}
          </strong>
        </div>
        <div className={styles.summaryRow}>
          <span>Inductance</span>
          <strong title="Buck: L = Vout·(1−D) / (ΔiL·fsw)&#10;Boost: L = Vin·D / (ΔiL·fsw)&#10;ΔiL = rippleRatio·Iout">
            {result ? `${(result.inductance * 1e6).toFixed(2)} µH` : '—'}
          </strong>
        </div>
        <div className={styles.summaryRow}>
          <span>Capacitance</span>
          <strong title="Buck: C = ΔiL / (8·fsw·ΔVout)&#10;Boost/BB: C = Iout·D / (fsw·ΔVout)">
            {result ? `${(result.capacitance * 1e6).toFixed(1)} µF` : '—'}
          </strong>
        </div>
        <div className={styles.summaryRow}>
          <span>Peak current</span>
          <strong title="Ipeak = Iout + ΔiL/2&#10;ΔiL = rippleRatio·Iout">
            {result ? `${result.peakCurrent.toFixed(2)} A` : '—'}
          </strong>
        </div>
        <div className={styles.summaryRow}>
          <span>Efficiency</span>
          <strong title="η = Pout / (Pout + Ploss)&#10;Pout = Vout·Iout">
            {result?.efficiency != null ? `${(result.efficiency * 100).toFixed(1)} %` : '—'}
          </strong>
        </div>
      </div>
    </div>
  )
}
