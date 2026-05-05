import React, { useState, useMemo } from 'react'
import { useDesignStore, type DesignSpec } from '../../store/design-store'
import { validateSpec } from '../../engine/validation'
import type { ValidationError } from '../../engine/validation'
import { Tooltip } from '../Tooltip/Tooltip'
import styles from './InputPanel.module.css'

// ── Field definitions ─────────────────────────────────────────────────────────

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
  tooltip?: string
}

const SPEC_FIELDS_BASE: FieldDef[] = [
  {
    key: 'vinMin', label: 'Vin min', unit: 'V', min: 1, max: 1000, step: 0.1, decimals: 1,
    tooltip: 'Minimum input voltage. Lower voltage = smaller inductor but higher current stress.',
  },
  {
    key: 'vinMax', label: 'Vin max', unit: 'V', min: 1, max: 1000, step: 0.1, decimals: 1,
    tooltip: 'Maximum input voltage. Higher voltage = larger MOSFET voltage rating required.',
  },
  {
    key: 'vout', label: 'Vout', unit: 'V', min: 0.5, max: 500, step: 0.1, decimals: 2,
    tooltip: 'Output voltage setpoint. The tool will calculate duty cycle and component values to achieve this.',
  },
  {
    key: 'iout', label: 'Iout', unit: 'A', min: 0.01, max: 50, step: 0.1, decimals: 2,
    tooltip: 'Output current. Higher current = larger inductor and capacitor ripple current ratings.',
  },
]

// Vout field override for buck-boost: negative output voltage
const VOUT_BUCK_BOOST: FieldDef = {
  key: 'vout', label: 'Vout', unit: 'V', min: -500, max: -0.1, step: 0.1, decimals: 2,
  tooltip: 'Output voltage for buck-boost. Enter as a negative value (e.g. −5 V for a −5 V rail).',
}

const OPERATING_FIELDS: FieldDef[] = [
  {
    key: 'fsw', label: 'Switching freq', unit: 'kHz',
    min: 1_000, max: 5_000_000, step: 1, decimals: 0, scale: 1000, log: true,
    tooltip: 'Switching frequency. Higher = smaller L/C but higher switching losses & EMI. Typical: 100 kHz–2 MHz.',
  },
  {
    key: 'rippleRatio', label: 'Ripple ratio', unit: '',
    min: 0.05, max: 0.8, step: 0.01, decimals: 2,
    tooltip: 'Inductor current ripple as fraction of Iout. Higher = smaller L but larger ripple. Typical: 0.2–0.4.',
  },
  {
    key: 'ambientTemp', label: 'Ambient temp', unit: '°C',
    min: -40, max: 125, step: 1, decimals: 0,
    tooltip: 'Ambient temperature. Used to calculate junction temperature and thermal margins.',
  },
]

const TARGET_FIELDS: FieldDef[] = [
  {
    key: 'voutRippleMax', label: 'Vout ripple max', unit: 'mV',
    min: 0.001, max: 5, step: 0.001, decimals: 0, scale: 1000,
    tooltip: 'Maximum allowed output voltage ripple (peak-to-peak). Larger Cout reduces ripple but increases size/cost.',
  },
  {
    key: 'efficiency', label: 'Efficiency target', unit: '%',
    min: 0.5, max: 0.99, step: 0.01, decimals: 0, scale: 0.01,
    tooltip: 'Target efficiency. Tool uses this to size components for optimal performance. Typical: 85–95 %.',
  },
]

// ── Slider helpers ────────────────────────────────────────────────────────────

function toDisplay(field: FieldDef, raw: number): number {
  return field.scale ? raw / field.scale : raw
}

function toRaw(field: FieldDef, display: number): number {
  return field.scale ? display * field.scale : display
}

function sliderValue(field: FieldDef, raw: number): number {
  if (field.log) return Math.log10(Math.abs(raw))
  return toDisplay(field, raw)
}

function sliderMin(field: FieldDef): number {
  if (field.log) return Math.log10(Math.abs(field.min))
  return field.scale ? field.min / field.scale : field.min
}

function sliderMax(field: FieldDef): number {
  if (field.log) return Math.log10(Math.abs(field.max))
  return field.scale ? field.max / field.scale : field.max
}

function sliderStep(field: FieldDef): number {
  return field.log ? 0.01 : field.step
}

function formatDisplay(value: number, decimals: number): string {
  return Number.isFinite(value) ? value.toFixed(decimals) : '—'
}

// ── Component ─────────────────────────────────────────────────────────────────

export function InputPanel(): React.ReactElement {
  const { spec, result, topology, updateSpec, requestMcRun, setActiveVizTab, notes, setNotes } = useDesignStore()
  const [mcIterations, setMcIterations] = useState(1000)
  const [mcSeed, setMcSeed] = useState(42)

  // Topology-aware spec fields
  const specFields = useMemo((): FieldDef[] =>
    SPEC_FIELDS_BASE.map((f) => (f.key === 'vout' && topology === 'buck-boost') ? VOUT_BUCK_BOOST : f),
  [topology])

  const SECTIONS = [
    { title: 'Specifications', fields: specFields },
    { title: 'Operating',      fields: OPERATING_FIELDS },
    { title: 'Targets',        fields: TARGET_FIELDS },
  ]

  // Run validation on every render (pure function, cheap)
  const validation = validateSpec(topology, spec)

  // Build field-key → errors map for O(1) lookup in JSX
  const errorsByField = useMemo((): Map<string, ValidationError[]> => {
    const map = new Map<string, ValidationError[]>()
    for (const e of validation.errors) {
      const list = map.get(e.field) ?? []
      list.push(e)
      map.set(e.field, list)
    }
    return map
  }, [validation.errors])

  const onFieldChange = (field: FieldDef, value: number) => {
    const normalized = field.log ? Math.pow(10, value) : value
    // For buck-boost vout: the slider goes through positive log-space but the
    // actual value is negative, so we preserve the sign from the raw spec value.
    if (field.key === 'vout' && topology === 'buck-boost') {
      updateSpec({ vout: -Math.abs(field.log ? normalized : toRaw(field, normalized)) } as Partial<DesignSpec>)
      return
    }
    const raw = field.log ? normalized : toRaw(field, normalized)
    updateSpec({ [field.key]: raw } as Partial<DesignSpec>)
  }

  return (
    <div className={styles.panel}>

      {/* ── Scrollable input area ── */}
      <div className={styles.scrollArea}>
        <div className={styles.header}>Design Inputs</div>

        {/* Global validation summary — only errors, not warnings */}
        {validation.errors.some((e) => e.severity === 'error') && (
          <div className={styles.validationBanner}>
            <span className={styles.validationBannerIcon}>⚠</span>
            <span>Fix errors below — computation is paused.</span>
          </div>
        )}

        <div className={styles.sections}>
          {SECTIONS.map((section) => (
            <details key={section.title} open className={styles.section}>
              <summary className={styles.sectionTitle}>{section.title}</summary>
              <div className={styles.sectionBody}>
                {section.fields.map((field) => {
                  const rawValue    = spec[field.key] as number
                  const displayValue = toDisplay(field, rawValue)
                  const minDisplay  = toDisplay(field, field.min)
                  const maxDisplay  = toDisplay(field, field.max)
                  const fieldErrors = errorsByField.get(field.key) ?? []
                  const hasError    = fieldErrors.some((e) => e.severity === 'error')
                  const hasWarning  = !hasError && fieldErrors.some((e) => e.severity === 'warning')

                  return (
                    <div key={field.key} className={styles.fieldRow}>
                      <div className={styles.rowLabel}>
                        <span>{field.label}</span>
                        {field.tooltip && (
                          <Tooltip content={field.tooltip} side="right">
                            <span className={styles.infoIcon}>ⓘ</span>
                          </Tooltip>
                        )}
                        <span className={styles.rowUnit}>{field.unit}</span>
                      </div>

                      <input
                        type="range"
                        className={[
                          styles.slider,
                          hasError   ? styles.sliderError   : '',
                          hasWarning ? styles.sliderWarning : '',
                        ].join(' ')}
                        min={sliderMin(field)}
                        max={sliderMax(field)}
                        step={sliderStep(field)}
                        value={sliderValue(field, rawValue)}
                        onChange={(e) => onFieldChange(field, Number(e.target.value))}
                      />

                      <div className={styles.rowControls}>
                        <input
                          type="number"
                          className={[
                            styles.numberInput,
                            hasError   ? styles.numberInputError   : '',
                            hasWarning ? styles.numberInputWarning : '',
                          ].join(' ')}
                          value={displayValue}
                          step={field.step}
                          onChange={(e) => onFieldChange(field, Number(e.target.value))}
                        />
                        <span className={styles.unitLabel}>{field.unit}</span>
                      </div>

                      <div className={styles.rangeHints}>
                        <span>{formatDisplay(minDisplay, field.decimals)}</span>
                        <span>{formatDisplay(maxDisplay, field.decimals)}</span>
                      </div>

                      {/* Inline validation messages */}
                      {fieldErrors.map((err, i) => (
                        <div
                          key={i}
                          className={[
                            styles.validationMsg,
                            err.severity === 'error' ? styles.validationError : styles.validationWarning,
                          ].join(' ')}
                        >
                          <span>{err.severity === 'error' ? '✕' : '⚠'}</span>
                          <span>{err.message}</span>
                        </div>
                      ))}
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
            <strong>{result ? `${(result.dutyCycle * 100).toFixed(1)} %` : '—'}</strong>
          </div>
          <div className={styles.summaryRow}>
            <span>Inductance</span>
            <strong>{result ? `${(result.inductance * 1e6).toFixed(2)} µH` : '—'}</strong>
          </div>
          <div className={styles.summaryRow}>
            <span>Capacitance</span>
            <strong>{result ? `${(result.capacitance * 1e6).toFixed(1)} µF` : '—'}</strong>
          </div>
          <div className={styles.summaryRow}>
            <span>Peak current</span>
            <strong>{result ? `${result.peakCurrent.toFixed(2)} A` : '—'}</strong>
          </div>
          <div className={styles.summaryRow}>
            <span>Efficiency</span>
            <strong>{result?.efficiency != null ? `${(result.efficiency * 100).toFixed(1)} %` : '—'}</strong>
          </div>
        </div>

        <details className={styles.notesSection}>
          <summary className={styles.notesSectionTitle}>Notes</summary>
          <textarea
            className={styles.notesTextarea}
            placeholder="Type design notes here…"
            value={notes}
            rows={4}
            onChange={(e) => setNotes(e.target.value)}
          />
        </details>

      </div>

      {/* ── Monte Carlo footer — always visible ── */}
      <div className={styles.mcFooter}>
        <div className={styles.mcLabel}>Monte Carlo</div>
        <div className={styles.mcControls}>
          <span className={styles.mcFieldLabel}>n =</span>
          <input
            type="number"
            className={styles.mcInput}
            value={mcIterations}
            min={100}
            max={10000}
            step={100}
            onChange={(e) => setMcIterations(Math.max(100, Math.min(10000, Number(e.target.value))))}
          />
          <span className={styles.mcFieldLabel}>seed</span>
          <input
            type="number"
            className={styles.mcInput}
            value={mcSeed}
            min={0}
            step={1}
            onChange={(e) => setMcSeed(Math.max(0, Number(e.target.value)))}
          />
          <div className={styles.mcSpacer} />
          <button
            className={styles.mcButton}
            disabled={!result}
            onClick={() => {
              requestMcRun({ iterations: mcIterations, seed: mcSeed, computePhaseMargin: false })
              setActiveVizTab('monte-carlo')
            }}
          >
            Run
          </button>
        </div>
      </div>

    </div>
  )
}
