// Main input panel: spec fields, multi-output (flyback), advanced sections, Monte Carlo footer.
// Per-section UI lives in sibling files (FieldRow, MultiOutputBlock, MonteCarloFooter, AdvancedXxx).

import React, { useMemo, useCallback } from 'react'
import { useDesignStore } from '../../store/design-store'
import type { DesignSpec, SecondaryOutput } from '../../engine/types'
import { validateSpec } from '../../engine/validation'
import {
  SPEC_FIELDS_BASE, VOUT_BUCK_BOOST, OPERATING_FIELDS, TARGET_FIELDS, DEFAULT_SECONDARY,
  type FieldDef, toRaw,
} from './inputPanelDefs'
import { AdvancedBuckSection }                          from './AdvancedBuckSection'
import { AdvancedFlybackSection, AdvancedBoostSection } from './AdvancedIsolatedSection'
import { FeedbackSection, SoftStartSection }            from './FeedbackSoftStartSection'
import { InputFilterSection }                            from './InputFilterSection'
import { FieldRow }            from './FieldRow'
import { MultiOutputBlock }    from './MultiOutputBlock'
import { MonteCarloFooter }    from './MonteCarloFooter'
import { useFieldErrors }      from './useFieldErrors'
import styles from './InputPanel.module.css'

const MAX_SECONDARIES = 3

function useSpecFields(topology: string): FieldDef[] {
  return useMemo(
    () => SPEC_FIELDS_BASE.map((f) => (f.key === 'vout' && topology === 'buck-boost') ? VOUT_BUCK_BOOST : f),
    [topology],
  )
}

function ValidationBanner({ blocked }: { blocked: boolean }): React.ReactElement | null {
  if (!blocked) return null
  return (
    <div className={styles.validationBanner}>
      <span className={styles.validationBannerIcon}>⚠</span>
      <span>Fix errors below — computation is paused.</span>
    </div>
  )
}

interface SpecSectionProps {
  title: string
  fields: FieldDef[]
  spec: DesignSpec
  errorsByField: Map<string, ReturnType<typeof validateSpec>['errors']>
  onFieldChange: (field: FieldDef, value: number) => void
}

function SpecSection({ title, fields, spec, errorsByField, onFieldChange }: SpecSectionProps): React.ReactElement {
  return (
    <details key={title} open className={styles.section}>
      <summary className={styles.sectionTitle}>{title}</summary>
      <div className={styles.sectionBody}>
        {fields.map((field) => (
          <FieldRow
            key={field.key as string}
            field={field}
            rawValue={spec[field.key] as number}
            fieldErrors={errorsByField.get(field.key as string) ?? []}
            onChange={onFieldChange}
          />
        ))}
      </div>
    </details>
  )
}

export function InputPanel(): React.ReactElement {
  const { spec, result, topology, updateSpec, requestMcRun, setActiveVizTab } = useDesignStore()
  const specFields    = useSpecFields(topology)
  const validation    = validateSpec(topology, spec)
  const errorsByField = useFieldErrors(validation.errors)
  const blocked       = validation.errors.some((e) => e.severity === 'error')
  const secondaries   = spec.secondary_outputs ?? []

  const onFieldChange = useCallback((field: FieldDef, value: number) => {
    const normalized = field.log ? Math.pow(10, value) : value
    if (field.key === 'vout' && topology === 'buck-boost') {
      updateSpec({ vout: -Math.abs(field.log ? normalized : toRaw(field, normalized)) } as Partial<DesignSpec>)
      return
    }
    updateSpec({ [field.key]: field.log ? normalized : toRaw(field, normalized) } as Partial<DesignSpec>)
  }, [topology, updateSpec])

  const addSecondary = useCallback(() => {
    if (secondaries.length >= MAX_SECONDARIES) return
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

  const sections = [
    { title: 'Specifications', fields: specFields },
    { title: 'Operating',      fields: OPERATING_FIELDS },
    { title: 'Targets',        fields: TARGET_FIELDS },
  ]

  const runMonteCarlo = (iterations: number, seed: number) => {
    requestMcRun({ iterations, seed, computePhaseMargin: false })
    setActiveVizTab('monte-carlo')
  }

  return (
    <div className={styles.panel}>
      <div className={styles.scrollArea}>
        <div className={styles.header}>Design Inputs</div>
        <ValidationBanner blocked={blocked} />

        <div className={styles.sections}>
          {sections.map((s) => (
            <SpecSection key={s.title} title={s.title} fields={s.fields}
              spec={spec} errorsByField={errorsByField} onFieldChange={onFieldChange} />
          ))}
        </div>

        {topology === 'flyback' && (
          <MultiOutputBlock
            secondaries={secondaries}
            onAdd={addSecondary} onToggle={toggleMultiOutput}
            onChange={updateSecondary} onRemove={removeSecondary}
          />
        )}

        <AdvancedBuckSection />
        <AdvancedFlybackSection />
        <AdvancedBoostSection />
        <FeedbackSection />
        <SoftStartSection />
        <InputFilterSection />
      </div>

      <MonteCarloFooter resultAvailable={!!result} onRun={runMonteCarlo} />
    </div>
  )
}
