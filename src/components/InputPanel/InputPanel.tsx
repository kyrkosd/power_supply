import React from 'react'
import { useWorkbenchStore, DesignInputs } from '../../store/workbenchStore'
import styles from './InputPanel.module.css'

interface FieldDef {
  key: keyof DesignInputs
  label: string
  unit: string
  min: number
  max: number
  step: number
  decimals: number
  scale?: number
}

const FIELDS: FieldDef[] = [
  { key: 'vinMin',      label: 'Vin min',      unit: 'V',   min: 1,   max: 100, step: 0.5,   decimals: 1 },
  { key: 'vinMax',      label: 'Vin max',      unit: 'V',   min: 1,   max: 100, step: 0.5,   decimals: 1 },
  { key: 'vout',        label: 'Vout',         unit: 'V',   min: 0.5, max: 60,  step: 0.1,   decimals: 2 },
  { key: 'iout',        label: 'Iout',         unit: 'A',   min: 0.1, max: 50,  step: 0.1,   decimals: 2 },
  { key: 'fsw',         label: 'Fsw',          unit: 'kHz', min: 10,  max: 5000, step: 10,   decimals: 0, scale: 1000 },
  { key: 'efficiency',  label: 'Efficiency',   unit: '%',   min: 50,  max: 100, step: 1,     decimals: 0, scale: 0.01 }
]

function toDisplay(field: FieldDef, raw: number): number {
  return field.scale ? raw / field.scale : raw
}

function toRaw(field: FieldDef, display: number): number {
  return field.scale ? display * field.scale : display
}

export function InputPanel(): React.ReactElement {
  const { inputs, results, setInput } = useWorkbenchStore()

  return (
    <div className={styles.panel}>
      <div className={styles.header}>Design Parameters</div>

      <div className={styles.fields}>
        {FIELDS.map((f) => {
          const displayVal = toDisplay(f, inputs[f.key] as number)
          return (
            <div key={f.key} className={styles.field}>
              <div className={styles.fieldHeader}>
                <span className={styles.fieldLabel}>{f.label}</span>
                <span className={styles.fieldValue}>
                  {displayVal.toFixed(f.decimals)}&thinsp;
                  <span className={styles.unit}>{f.unit}</span>
                </span>
              </div>
              <input
                type="range"
                className={styles.slider}
                min={f.min}
                max={f.max}
                step={f.step}
                value={displayVal}
                onChange={(e) => setInput(f.key, toRaw(f, parseFloat(e.target.value)))}
              />
              <div className={styles.rangeHints}>
                <span>{f.min}</span>
                <span>{f.max} {f.unit}</span>
              </div>
            </div>
          )
        })}
      </div>

      <div className={styles.divider} />

      <div className={styles.header}>Results</div>
      <div className={styles.results}>
        <ResultRow label="Duty Cycle" value={results.dutyCycle} unit="%" scale={100} decimals={1} />
        <ResultRow label="Inductance" value={results.inductance} unit="µH" scale={1e6} decimals={2} />
        <ResultRow label="Capacitance" value={results.capacitance} unit="µF" scale={1e6} decimals={2} />
        <ResultRow label="Peak Current" value={results.peakCurrent} unit="A" decimals={2} />
      </div>
    </div>
  )
}

function ResultRow({
  label,
  value,
  unit,
  scale = 1,
  decimals
}: {
  label: string
  value: number | null
  unit: string
  scale?: number
  decimals: number
}): React.ReactElement {
  return (
    <div className={styles.resultRow}>
      <span className={styles.resultLabel}>{label}</span>
      <span className={styles.resultValue}>
        {value === null ? (
          <span className={styles.placeholder}>—</span>
        ) : (
          <>
            {(value * scale).toFixed(decimals)}&thinsp;
            <span className={styles.unit}>{unit}</span>
          </>
        )}
      </span>
    </div>
  )
}
