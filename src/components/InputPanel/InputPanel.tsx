// Main input panel: spec fields, multi-output (flyback), advanced sections, Monte Carlo footer.
import React, { useState, useMemo, useCallback } from 'react'
import { useDesignStore } from '../../store/design-store'
import type { DesignSpec, SecondaryOutput } from '../../engine/types'
import { validateSpec } from '../../engine/validation'
import type { ValidationError } from '../../engine/validation'
import { Tooltip } from '../Tooltip/Tooltip'
import {
  SPEC_FIELDS_BASE, VOUT_BUCK_BOOST, OPERATING_FIELDS, TARGET_FIELDS, DEFAULT_SECONDARY,
  type FieldDef, toDisplay, toRaw, sliderValue, sliderMin, sliderMax, sliderStep, formatDisplay,
} from './inputPanelDefs'
import { AdvancedBuckSection }    from './AdvancedBuckSection'
import { AdvancedFlybackSection, AdvancedBoostSection } from './AdvancedIsolatedSection'
import { FeedbackSection, SoftStartSection } from './FeedbackSoftStartSection'
import { InputFilterSection }     from './InputFilterSection'
import styles from './InputPanel.module.css'

// ── Secondary output row ──────────────────────────────────────────────────────

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
      <input type="number" className={styles.secondaryInput} value={output.vout}
        min={0.1} max={500} step={0.1}
        onChange={(e) => onChange(index, { ...output, vout: Number(e.target.value) })} />
      <span className={styles.secondaryUnit}>V</span>
      <label className={styles.secondaryFieldLabel}>Iout</label>
      <input type="number" className={styles.secondaryInput} value={output.iout}
        min={0.01} max={50} step={0.1}
        onChange={(e) => onChange(index, { ...output, iout: Number(e.target.value) })} />
      <span className={styles.secondaryUnit}>A</span>
      <label className={styles.secondaryFieldLabel}>Vf</label>
      <input type="number" className={styles.secondaryInput} value={output.diode_vf}
        min={0} max={2} step={0.05}
        onChange={(e) => onChange(index, { ...output, diode_vf: Number(e.target.value) })} />
      <span className={styles.secondaryUnit}>V</span>
      <button className={styles.secondaryRemove} onClick={() => onRemove(index)} title="Remove this output">✕</button>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

/** Primary input panel — spec fields, multi-output windings, topology-specific advanced settings. */
export function InputPanel(): React.ReactElement {
  const { spec, result, topology, updateSpec, requestMcRun, setActiveVizTab } = useDesignStore()
  const [mcIterations, setMcIterations] = useState(1000)
  const [mcSeed, setMcSeed] = useState(42)

  const specFields = useMemo((): FieldDef[] =>
    SPEC_FIELDS_BASE.map((f) => (f.key === 'vout' && topology === 'buck-boost') ? VOUT_BUCK_BOOST : f),
  [topology])

  const SECTIONS = [
    { title: 'Specifications', fields: specFields },
    { title: 'Operating',      fields: OPERATING_FIELDS },
    { title: 'Targets',        fields: TARGET_FIELDS },
  ]

  const validation   = validateSpec(topology, spec)
  const errorsByField = useMemo((): Map<string, ValidationError[]> => {
    const map = new Map<string, ValidationError[]>()
    for (const e of validation.errors) {
      const list = map.get(e.field) ?? []
      list.push(e)
      map.set(e.field, list)
    }
    return map
  }, [validation.errors])

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
    updateSpec({ secondary_outputs: secondaries.map((s, i) => (i === index ? updated : s)) })
  }, [secondaries, updateSpec])

  const toggleMultiOutput = useCallback(() => {
    updateSpec({ secondary_outputs: secondaries.length > 0 ? undefined : [{ ...DEFAULT_SECONDARY }] })
  }, [secondaries, updateSpec])

  const onFieldChange = useCallback((field: FieldDef, value: number) => {
    const normalized = field.log ? Math.pow(10, value) : value
    if (field.key === 'vout' && topology === 'buck-boost') {
      // Preserve negative polarity — buck-boost output is always negative
      updateSpec({ vout: -Math.abs(field.log ? normalized : toRaw(field, normalized)) } as Partial<DesignSpec>)
      return
    }
    updateSpec({ [field.key]: field.log ? normalized : toRaw(field, normalized) } as Partial<DesignSpec>)
  }, [topology, updateSpec])

  return (
    <div className={styles.panel}>

      <div className={styles.scrollArea}>
        <div className={styles.header}>Design Inputs</div>

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
                  const rawValue     = spec[field.key] as number
                  const displayValue = toDisplay(field, rawValue)
                  const fieldErrors  = errorsByField.get(field.key as string) ?? []
                  const hasError     = fieldErrors.some((e) => e.severity === 'error')
                  const hasWarning   = !hasError && fieldErrors.some((e) => e.severity === 'warning')

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
                        className={[styles.slider, hasError ? styles.sliderError : '', hasWarning ? styles.sliderWarning : ''].join(' ')}
                        min={sliderMin(field)} max={sliderMax(field)} step={sliderStep(field)}
                        value={sliderValue(field, rawValue)}
                        onChange={(e) => onFieldChange(field, Number(e.target.value))}
                      />
                      <div className={styles.rowControls}>
                        <input
                          type="number"
                          className={[styles.numberInput, hasError ? styles.numberInputError : '', hasWarning ? styles.numberInputWarning : ''].join(' ')}
                          value={displayValue}
                          step={field.step}
                          onChange={(e) => onFieldChange(field, Number(e.target.value))}
                        />
                        <span className={styles.unitLabel}>{field.unit}</span>
                      </div>
                      <div className={styles.rangeHints}>
                        <span>{formatDisplay(toDisplay(field, field.min), field.decimals)}</span>
                        <span>{formatDisplay(toDisplay(field, field.max), field.decimals)}</span>
                      </div>
                      {fieldErrors.map((err, i) => (
                        <div key={i} className={[styles.validationMsg, err.severity === 'error' ? styles.validationError : styles.validationWarning].join(' ')}>
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

        {/* Multi-output windings — flyback only */}
        {topology === 'flyback' && (
          <div className={styles.multiOutputSection}>
            <div className={styles.multiOutputHeader}>
              <span className={styles.multiOutputTitle}>Multi-Output Windings</span>
              <div className={styles.multiOutputHeaderActions}>
                {secondaries.length > 0 && secondaries.length < 3 && (
                  <button className={styles.multiOutputAdd} onClick={addSecondary} title="Add secondary winding (max 4 total)">+ Add Output</button>
                )}
                <button className={styles.multiOutputToggle} onClick={toggleMultiOutput}>
                  {secondaries.length > 0 ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
            {secondaries.length > 0 && (
              <>
                {secondaries.map((s, i) => (
                  <SecondaryOutputRow key={i} index={i} output={s} onChange={updateSecondary} onRemove={removeSecondary} />
                ))}
                {secondaries.length < 3 && (
                  <button className={styles.multiOutputAdd} onClick={addSecondary} title="Add another secondary winding">+ Add Output</button>
                )}
                <div className={styles.crossRegWarning}>
                  ⚠ Cross-regulation on unregulated outputs is typically ±5–10 %. Use post-regulators (LDO) for tight regulation.
                </div>
              </>
            )}
          </div>
        )}

        {/* Topology-specific advanced sections */}
        <AdvancedBuckSection />
        <AdvancedFlybackSection />
        <AdvancedBoostSection />

        {/* Global advanced sections */}
        <FeedbackSection />
        <SoftStartSection />
        <InputFilterSection />

      </div>

      {/* Monte Carlo footer — always visible */}
      <div className={styles.mcFooter}>
        <div className={styles.mcLabel}>Monte Carlo</div>
        <div className={styles.mcControls}>
          <span className={styles.mcFieldLabel}>n =</span>
          <input type="number" className={styles.mcInput} value={mcIterations}
            min={100} max={10000} step={100}
            onChange={(e) => setMcIterations(Math.max(100, Math.min(10000, Number(e.target.value))))} />
          <span className={styles.mcFieldLabel}>seed</span>
          <input type="number" className={styles.mcInput} value={mcSeed}
            min={0} step={1}
            onChange={(e) => setMcSeed(Math.max(0, Number(e.target.value)))} />
          <div className={styles.mcSpacer} />
          <button
            className={styles.mcButton}
            disabled={!result}
            onClick={() => { requestMcRun({ iterations: mcIterations, seed: mcSeed, computePhaseMargin: false }); setActiveVizTab('monte-carlo') }}
          >
            Run
          </button>
        </div>
      </div>

    </div>
  )
}
