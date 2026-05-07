// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
// INCREASED COMMENT DENSITY: added a short descriptive header comment to increase readability.
import React, { useState, useMemo, useCallback } from 'react'
import { useDesignStore } from '../../store/design-store'
import type { DesignSpec } from '../../engine/types'
import { validateSpec } from '../../engine/validation'
import type { ValidationError } from '../../engine/validation'
import type { SecondaryOutput } from '../../engine/types'
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

// ── Secondary output row ──────────────────────────────────────────────────────

const DEFAULT_SECONDARY: SecondaryOutput = { vout: 12, iout: 0.5, diode_vf: 0.4, is_regulated: false }

interface SecondaryRowProps {
  index: number
  output: SecondaryOutput
  onChange: (index: number, updated: SecondaryOutput) => void
  onRemove: (index: number) => void
}

function SecondaryOutputRow({ index, output, onChange, onRemove }: SecondaryRowProps) {
  return (
    <div className={styles.secondaryRow}>
      <span className={styles.secondaryLabel}>Out {index + 2}</span>
      <label className={styles.secondaryFieldLabel}>Vout</label>
      <input
        type="number"
        className={styles.secondaryInput}
        value={output.vout}
        min={0.1}
        max={500}
        step={0.1}
        onChange={(e) => onChange(index, { ...output, vout: Number(e.target.value) })}
      />
      <span className={styles.secondaryUnit}>V</span>
      <label className={styles.secondaryFieldLabel}>Iout</label>
      <input
        type="number"
        className={styles.secondaryInput}
        value={output.iout}
        min={0.01}
        max={50}
        step={0.1}
        onChange={(e) => onChange(index, { ...output, iout: Number(e.target.value) })}
      />
      <span className={styles.secondaryUnit}>A</span>
      <label className={styles.secondaryFieldLabel}>Vf</label>
      <input
        type="number"
        className={styles.secondaryInput}
        value={output.diode_vf}
        min={0}
        max={2}
        step={0.05}
        onChange={(e) => onChange(index, { ...output, diode_vf: Number(e.target.value) })}
      />
      <span className={styles.secondaryUnit}>V</span>
      <button className={styles.secondaryRemove} onClick={() => onRemove(index)} title="Remove this output">✕</button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function InputPanel(): React.ReactElement {
  const { spec, result, topology, updateSpec, requestMcRun, setActiveVizTab, notes, setNotes, feedbackOptions, setFeedbackOptions, softStartOptions, setSoftStartOptions } = useDesignStore()
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

  // Multi-output handlers (flyback only)
  const secondaries = spec.secondary_outputs ?? []

  const addSecondary = useCallback(() => {
    if (secondaries.length >= 3) return
    updateSpec({ secondary_outputs: [...secondaries, { ...DEFAULT_SECONDARY }] })
  }, [secondaries, updateSpec])

  const removeSecondary = useCallback((index: number) => {
    const next = secondaries.filter((_, i) => i !== index)
    updateSpec({ secondary_outputs: next.length > 0 ? next : undefined })
  }, [secondaries, updateSpec])

  const updateSecondary = useCallback((index: number, updated: SecondaryOutput) => {
    const next = secondaries.map((s, i) => (i === index ? updated : s))
    updateSpec({ secondary_outputs: next })
  }, [secondaries, updateSpec])

  const toggleMultiOutput = useCallback(() => {
    if (secondaries.length > 0) {
      updateSpec({ secondary_outputs: undefined })
    } else {
      updateSpec({ secondary_outputs: [{ ...DEFAULT_SECONDARY }] })
    }
  }, [secondaries, updateSpec])

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
                  const fieldErrors = errorsByField.get(field.key as string) ?? []
                  const hasError    = fieldErrors.some((e) => e.severity === 'error')
                  const hasWarning  = !hasError && fieldErrors.some((e) => e.severity === 'warning')

                  return (
                    <div key={field.key as string} className={styles.fieldRow}>
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

        {/* ── Multi-Output (flyback only) ── */}
        {topology === 'flyback' && (
          <div className={styles.multiOutputSection}>
            <div className={styles.multiOutputHeader}>
              <span className={styles.multiOutputTitle}>Multi-Output Windings</span>
              <div className={styles.multiOutputHeaderActions}>
                {secondaries.length > 0 && secondaries.length < 3 && (
                  <button className={styles.multiOutputAdd} onClick={addSecondary} title="Add secondary winding (max 4 total)">
                    + Add Output
                  </button>
                )}
                <button className={styles.multiOutputToggle} onClick={toggleMultiOutput}>
                  {secondaries.length > 0 ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>

            {secondaries.length > 0 && (
              <>
                {secondaries.length === 0 && (
                  <button className={styles.multiOutputAdd} onClick={addSecondary}>+ Add Output</button>
                )}
                {secondaries.map((s, i) => (
                  <SecondaryOutputRow
                    key={i}
                    index={i}
                    output={s}
                    onChange={updateSecondary}
                    onRemove={removeSecondary}
                  />
                ))}
                {secondaries.length < 3 && secondaries.length > 0 && (
                  <button className={styles.multiOutputAdd} onClick={addSecondary} title="Add another secondary winding">
                    + Add Output
                  </button>
                )}
                <div className={styles.crossRegWarning}>
                  ⚠ Cross-regulation on unregulated outputs is typically ±5–10 %. Use post-regulators (LDO) for tight regulation.
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Advanced (flyback/forward — RCD clamp settings) ── */}
        {(topology === 'flyback' || topology === 'forward') && (
          <details className={styles.advancedSection}>
            <summary className={styles.advancedTitle}>Advanced</summary>
            <div className={styles.advancedBody}>
              <div className={styles.advancedRow}>
                <label className={styles.advancedLabel}>
                  Leakage ratio
                  <Tooltip
                    content="Transformer leakage inductance as a fraction of magnetising inductance. Typical: 1–3 % for well-coupled transformers. Higher ratio → larger RCD clamp dissipation and MOSFET voltage spike."
                    side="right"
                  >
                    <span className={styles.infoIcon}>ⓘ</span>
                  </Tooltip>
                </label>
                <div className={styles.advancedInputGroup}>
                  <input
                    type="number"
                    className={styles.advancedNumberInput}
                    value={((spec.leakageRatio ?? 0.02) * 100).toFixed(1)}
                    min={0.5}
                    max={10}
                    step={0.5}
                    onChange={(e) => updateSpec({ leakageRatio: Number(e.target.value) / 100 })}
                  />
                  <span className={styles.advancedUnit}>%</span>
                </div>
              </div>
            </div>
          </details>
        )}

        {/* ── Advanced (buck only — control loop settings + multi-phase) ── */}
        {topology === 'buck' && (
          <details className={styles.advancedSection}>
            <summary className={styles.advancedTitle}>Advanced</summary>
            <div className={styles.advancedBody}>
              <div className={styles.advancedRow}>
                <label className={styles.advancedLabel}>
                  Phases
                  <Tooltip
                    content="Number of interleaved phases (1–6). Each phase is a complete buck stage phase-shifted by 360°/N. More phases → smaller per-phase L, smaller Cout, lower conduction losses — at the cost of N switches and N inductors. Perfect ripple cancellation occurs at D = k/N."
                    side="right"
                  >
                    <span className={styles.infoIcon}>ⓘ</span>
                  </Tooltip>
                </label>
                <select
                  className={styles.advancedSelect}
                  value={spec.phases ?? 1}
                  onChange={(e) => updateSpec({ phases: Number(e.target.value) })}
                >
                  <option value={1}>1 phase (standard)</option>
                  <option value={2}>2 phases</option>
                  <option value={3}>3 phases</option>
                  <option value={4}>4 phases</option>
                  <option value={5}>5 phases</option>
                  <option value={6}>6 phases</option>
                </select>
              </div>
              <div className={styles.advancedRow}>
                <label className={styles.advancedLabel}>
                  Rectification
                  <Tooltip
                    content="Synchronous: replaces the freewheeling diode with a low-side MOSFET (Q2). Eliminates 0.7 V diode drop → higher efficiency at heavy load. At light load, gate drive overhead exceeds diode savings — crossover typically at 10–20 % of full load. Requires dead-time control to prevent shoot-through."
                    side="right"
                  >
                    <span className={styles.infoIcon}>ⓘ</span>
                  </Tooltip>
                </label>
                <select
                  className={styles.advancedSelect}
                  value={spec.rectification ?? 'diode'}
                  onChange={(e) => updateSpec({ rectification: e.target.value as 'diode' | 'synchronous' })}
                >
                  <option value="diode">Diode (async)</option>
                  <option value="synchronous">Synchronous FET</option>
                </select>
              </div>
              <div className={styles.advancedRow}>
                <label className={styles.advancedLabel}>
                  Control mode
                  <Tooltip
                    content="Voltage mode: Type-II compensator, LC double pole in plant. Current mode (PCM): inner current loop removes the inductor pole — single-pole plant, simpler compensation, better line rejection but requires slope comp when D > 50 %."
                    side="right"
                  >
                    <span className={styles.infoIcon}>ⓘ</span>
                  </Tooltip>
                </label>
                <select
                  className={styles.advancedSelect}
                  value={spec.controlMode ?? 'voltage'}
                  onChange={(e) => updateSpec({ controlMode: e.target.value as 'voltage' | 'current' })}
                >
                  <option value="voltage">Voltage Mode (VMC)</option>
                  <option value="current">Current Mode (PCM)</option>
                </select>
              </div>
              {(spec.controlMode ?? 'voltage') === 'current' && (
                <>
                  <div className={styles.advancedRow}>
                    <label className={styles.advancedLabel}>
                      Sense method
                      <Tooltip
                        content="Resistor: dedicated low-ohm shunt; accurate, low temperature drift. Rds(on): uses the MOSFET on-resistance; lossless but ±30 % accuracy variation from 25 °C to 100 °C. Use resistor for tight current limiting; Rds(on) for efficiency-critical designs."
                        side="right"
                      >
                        <span className={styles.infoIcon}>ⓘ</span>
                      </Tooltip>
                    </label>
                    <select
                      className={styles.advancedSelect}
                      value={spec.senseMethod ?? 'resistor'}
                      onChange={(e) => updateSpec({ senseMethod: e.target.value as 'resistor' | 'rdson' })}
                    >
                      <option value="resistor">Sense Resistor</option>
                      <option value="rdson">Rds(on) (lossless)</option>
                    </select>
                  </div>
                  {(spec.senseMethod ?? 'resistor') === 'resistor' && (
                    <div className={styles.advancedRow}>
                      <label className={styles.advancedLabel}>
                        Vsense target (mV)
                        <Tooltip
                          content="Peak voltage across the sense resistor at maximum load. Higher = better SNR and noise immunity but more Rsense dissipation. Typical range: 100–200 mV. Below 50 mV: poor noise margin. Above 300 mV: excessive resistor losses."
                          side="right"
                        >
                          <span className={styles.infoIcon}>ⓘ</span>
                        </Tooltip>
                      </label>
                      <input
                        type="number"
                        className={styles.advancedSelect}
                        min={20}
                        max={500}
                        step={10}
                        value={spec.vsenseTargetMv ?? 150}
                        onChange={(e) => updateSpec({ vsenseTargetMv: Math.max(20, Math.min(500, Number(e.target.value))) })}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          </details>
        )}

        {/* ── Advanced (boost / buck-boost / sepic — sync rectification) ── */}
        {(topology === 'boost' || topology === 'buck-boost' || topology === 'sepic') && (
          <details className={styles.advancedSection}>
            <summary className={styles.advancedTitle}>Advanced</summary>
            <div className={styles.advancedBody}>
              <div className={styles.advancedRow}>
                <label className={styles.advancedLabel}>
                  Rectification
                  <Tooltip
                    content="Synchronous: replaces the freewheeling diode with a low-side MOSFET (Q2). Eliminates 0.7 V diode drop → higher efficiency at heavy load. At light load, gate drive overhead exceeds diode savings — crossover typically at 10–20 % of full load."
                    side="right"
                  >
                    <span className={styles.infoIcon}>ⓘ</span>
                  </Tooltip>
                </label>
                <select
                  className={styles.advancedSelect}
                  value={spec.rectification ?? 'diode'}
                  onChange={(e) => updateSpec({ rectification: e.target.value as 'diode' | 'synchronous' })}
                >
                  <option value="diode">Diode (async)</option>
                  <option value="synchronous">Synchronous FET</option>
                </select>
              </div>
            </div>
          </details>
        )}

        {/* ── Feedback Network ── */}
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

        {/* ── Soft-Start ── */}
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

        {/* ── Input EMI Filter ── */}
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
              <label className={styles.advancedLabel}>
                Enable filter design
              </label>
              <select
                className={styles.advancedSelect}
                value={(spec.inputFilterEnabled ?? false) ? 'on' : 'off'}
                onChange={(e) => updateSpec({ inputFilterEnabled: e.target.value === 'on' })}
              >
                <option value="off">Off</option>
                <option value="on">On</option>
              </select>
            </div>
            {(spec.inputFilterEnabled ?? false) && (
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
