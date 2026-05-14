// One spec/operating/target row: slider, numeric input, range hints, and validation messages.
import React from 'react'
import type { ValidationError } from '../../engine/validation'
import { Tooltip } from '../Tooltip/Tooltip'
import {
  type FieldDef, toDisplay, sliderValue, sliderMin, sliderMax, sliderStep, formatDisplay,
} from './inputPanelDefs'
import styles from './InputPanel.module.css'

interface FieldRowProps {
  field: FieldDef
  rawValue: number
  fieldErrors: ValidationError[]
  onChange: (field: FieldDef, value: number) => void
}

function classes(...cs: Array<string | false | undefined>): string {
  return cs.filter(Boolean).join(' ')
}

function FieldLabel({ field }: { field: FieldDef }): React.ReactElement {
  return (
    <div className={styles.rowLabel}>
      <span>{field.label}</span>
      {field.tooltip && (
        <Tooltip content={field.tooltip} side="right">
          <span className={styles.infoIcon}>ⓘ</span>
        </Tooltip>
      )}
      <span className={styles.rowUnit}>{field.unit}</span>
    </div>
  )
}

function ValidationMessages({ errors }: { errors: ValidationError[] }): React.ReactElement {
  return (
    <>
      {errors.map((err, i) => (
        <div key={i} className={classes(styles.validationMsg, err.severity === 'error' ? styles.validationError : styles.validationWarning)}>
          <span>{err.severity === 'error' ? '✕' : '⚠'}</span>
          <span>{err.message}</span>
        </div>
      ))}
    </>
  )
}

export function FieldRow({ field, rawValue, fieldErrors, onChange }: FieldRowProps): React.ReactElement {
  const displayValue = toDisplay(field, rawValue)
  const hasError     = fieldErrors.some((e) => e.severity === 'error')
  const hasWarning   = !hasError && fieldErrors.some((e) => e.severity === 'warning')

  return (
    <div className={styles.fieldRow}>
      <FieldLabel field={field} />
      <input
        type="range"
        className={classes(styles.slider, hasError && styles.sliderError, hasWarning && styles.sliderWarning)}
        min={sliderMin(field)} max={sliderMax(field)} step={sliderStep(field)}
        value={sliderValue(field, rawValue)}
        onChange={(e) => onChange(field, Number(e.target.value))}
      />
      <div className={styles.rowControls}>
        <input
          type="number"
          className={classes(styles.numberInput, hasError && styles.numberInputError, hasWarning && styles.numberInputWarning)}
          value={displayValue}
          step={field.step}
          onChange={(e) => onChange(field, Number(e.target.value))}
        />
        <span className={styles.unitLabel}>{field.unit}</span>
      </div>
      <div className={styles.rangeHints}>
        <span>{formatDisplay(toDisplay(field, field.min), field.decimals)}</span>
        <span>{formatDisplay(toDisplay(field, field.max), field.decimals)}</span>
      </div>
      <ValidationMessages errors={fieldErrors} />
    </div>
  )
}
